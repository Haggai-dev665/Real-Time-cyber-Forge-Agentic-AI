//! Portable, non-executable detector data. No Python process, HTTP server or
//! language model lies on the local URL-check path. Export parity is tested
//! against the original, immutable sklearn models (not invented predictions).
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
mod features;
pub use features::extract;

#[derive(Deserialize)]
pub struct Pack {
    pub schema: u32,
    pub source_revision: String,
    pub popular_domains: Vec<String>,
    pub models: Vec<Model>,
    #[serde(skip)]
    pub popularity: HashMap<String, usize>,
}
#[derive(Deserialize)]
pub struct Model {
    pub name: String,
    pub kind: String,
    pub features: Vec<String>,
    pub threshold: f64,
    pub bias: f64,
    #[serde(default)]
    pub normalizer: f64,
    pub trees: Vec<Vec<Node>>,
}
#[derive(Deserialize)]
pub struct Node(usize, f64, i32, i32, f64, bool, bool);

impl Pack {
    pub fn from_gzip(bytes: &[u8]) -> Result<Self, String> {
        use std::io::Read;
        let mut data = Vec::new();
        flate2::read::GzDecoder::new(bytes)
            .take(64 * 1024 * 1024 + 1)
            .read_to_end(&mut data)
            .map_err(|e| format!("Invalid detector archive: {e}"))?;
        Self::parse(&data)
    }
    pub fn parse(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() > 64 * 1024 * 1024 {
            return Err("Detector pack exceeds size limit".into());
        }
        let mut p: Self =
            serde_json::from_slice(bytes).map_err(|e| format!("Invalid detector pack: {e}"))?;
        if p.schema != 1 || p.models.len() != 4 || p.popular_domains.is_empty() {
            return Err("Incomplete detector pack".into());
        }
        let names: HashSet<_> = p.models.iter().map(|m| m.name.as_str()).collect();
        if names
            != HashSet::from([
                "phishing_detection",
                "malware_detection",
                "web_attack_detection",
                "anomaly_detection",
            ])
        {
            return Err("Unexpected detector set".into());
        }
        let known = extract("https://example.com/", &HashMap::new());
        for m in &p.models {
            if !["hist_gradient_boosting", "isolation_forest"].contains(&m.kind.as_str())
                || !m.bias.is_finite()
                || !(0.0..1.0).contains(&m.threshold)
                || m.trees.is_empty()
                || m.trees.len() > 1000
                || m.features.iter().any(|f| !known.contains_key(f))
            {
                return Err("Unsupported detector schema".into());
            }
            if m.kind == "isolation_forest" && (m.normalizer <= 0. || !m.normalizer.is_finite()) {
                return Err("Invalid anomaly normalizer".into());
            }
            for tree in &m.trees {
                if tree.is_empty() || tree.len() > 65536 {
                    return Err("Invalid detector tree".into());
                }
                for (i, n) in tree.iter().enumerate() {
                    if n.0 >= m.features.len()
                        || !n.1.is_finite()
                        || !n.4.is_finite()
                        || (!n.5
                            && [n.2, n.3]
                                .iter()
                                .any(|&v| v <= i as i32 || v as usize >= tree.len()))
                    {
                        return Err("Invalid detector node".into());
                    }
                }
            }
        }
        for (i, name) in p.popular_domains.iter().enumerate() {
            p.popularity
                .entry(name.trim().to_lowercase())
                .or_insert(i + 1);
        }
        Ok(p)
    }
    pub fn scores(&self, url: &str) -> Result<(HashMap<String, f64>, Vec<Value>), String> {
        let f = extract(url, &self.popularity);
        let mut predictions = Vec::new();
        for m in &self.models {
            let x: Vec<f64> = m.features.iter().map(|n| f[n] as f32 as f64).collect();
            let raw = m.predict(&x);
            let anomaly = m.kind == "isolation_forest";
            let score = if anomaly {
                (0.5 - raw).clamp(0., 1.)
            } else {
                raw
            };
            predictions.push(json!({"model":m.name,"threat_score":score,"anomaly_margin":if anomaly{Some(raw)}else{None},"prediction":if score>=0.5{1}else{0},"score_kind":if anomaly{"anomaly_margin"}else{"threshold_rescaled_probability"},"inference_source":"local_ml_model"}));
        }
        Ok((f, predictions))
    }
}
impl Model {
    pub fn predict(&self, x: &[f64]) -> f64 {
        let mut sum = 0.;
        for tree in &self.trees {
            let mut i = 0;
            let mut depth = 0.;
            loop {
                let n = &tree[i];
                if n.5 {
                    sum += if self.kind == "isolation_forest" {
                        depth + n.4
                    } else {
                        n.4
                    };
                    break;
                }
                let left = if x[n.0].is_nan() { n.6 } else { x[n.0] <= n.1 };
                i = if left { n.2 } else { n.3 } as usize;
                depth += 1.;
            }
        }
        if self.kind == "isolation_forest" {
            return -2f64.powf(-sum / (self.trees.len() as f64 * self.normalizer)) - self.bias;
        }
        let raw = 1. / (1. + (-(self.bias + sum)).exp());
        if self.threshold > 0.5 {
            if raw < self.threshold {
                0.5 * raw / self.threshold
            } else {
                0.5 + 0.5 * (raw - self.threshold) / (1. - self.threshold)
            }
        } else {
            raw
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exported_pack_matches_original_sklearn_and_python_features() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../desktop/src-tauri/local-ml");
        let pack = Pack::from_gzip(&std::fs::read(root.join("core-v1.json.gz")).unwrap()).unwrap();
        let cases: Vec<Value> =
            serde_json::from_slice(&std::fs::read(root.join("parity.json")).unwrap()).unwrap();
        let started = std::time::Instant::now();
        for case in &cases {
            let url = case["url"].as_str().unwrap();
            let (f, pred) = pack.scores(url).unwrap();
            for (k, expected) in case["features"].as_object().unwrap() {
                assert!(
                    (f[k] - expected.as_f64().unwrap()).abs() < 0.00001,
                    "{url}: {k}: {} != {expected}",
                    f[k]
                );
            }
            for p in pred {
                let name = p["model"].as_str().unwrap();
                let got = if name == "anomaly_detection" {
                    p["anomaly_margin"].as_f64().unwrap()
                } else {
                    p["threat_score"].as_f64().unwrap()
                };
                let want = case["predictions"][name].as_f64().unwrap();
                assert!((got - want).abs() < 1e-7, "{url}: {name}: {got} != {want}");
            }
        }
        eprintln!("Native parity: {} URLs / {} model predictions; elapsed {:?} (debug, not a production benchmark)",cases.len(),cases.len()*4,started.elapsed());
    }
}
