/**
 * render.js — render the CyberForge .dot diagrams to .svg and .jpg.
 *
 * Uses @hpcc-js/wasm (Graphviz compiled to WebAssembly, so no system Graphviz
 * is required) to turn each .dot into an .svg, then sharp to rasterise the
 * .svg into a high-resolution .jpg. Run:  node render.js
 */
const fs = require("fs");
const path = require("path");
const { Graphviz } = require("@hpcc-js/wasm-graphviz");
const sharp = require("sharp");

const HERE = __dirname;
const DIAGRAMS = ["architecture_diagram", "class_diagram"];

(async () => {
  const graphviz = await Graphviz.load();

  for (const name of DIAGRAMS) {
    const dot = fs.readFileSync(path.join(HERE, name + ".dot"), "utf8");

    // .dot -> .svg
    const svg = graphviz.dot(dot);
    fs.writeFileSync(path.join(HERE, name + ".svg"), svg, "utf8");

    // .svg -> .jpg (2x density for a crisp raster, white background)
    await sharp(Buffer.from(svg), { density: 200 })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toFile(path.join(HERE, name + ".jpg"));

    console.log(name + ".svg + .jpg written");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
