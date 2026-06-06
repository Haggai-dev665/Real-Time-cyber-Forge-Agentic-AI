# CyberForge — Phishing Test Lab (site1 / site2 / site3)

> ⚠️ **EDUCATIONAL SECURITY-TEST ARTIFACTS — LOCALHOST ONLY.**
> These three PHP sites are deliberately built to look and behave like phishing /
> data-harvesting pages **so that the CyberForge detection system can be tested
> and demonstrated for a thesis defence.** They are not for use against real
> people. Run them only on your own machine, enter only **fake data**, and do not
> deploy them on a public URL. Each site refuses to run off `localhost` unless you
> explicitly set `ALLOW_REMOTE=1`.

## What each site is

| Folder | Pretends to be | Harvests | Realistic phishing markers |
| :--- | :--- | :--- | :--- |
| `site1` | "SecureMail" webmail login (fictional) | email + password | account-locked urgency, fake security badges, credential form |
| `site2` | "StreamForge" movie streaming (real catalog via TMDB) | email, password, card-style fields | "free trial" payment capture, brand styling |
| `site3` | "GlobalParcel" delivery / prize claim (fictional) | name, phone, address, DOB, ID last-4 | redelivery-fee lure, PII form |

All three are **fictional brands on purpose** — they exhibit the *technical*
characteristics a phishing detector keys on (credential/PII forms, urgency,
fake trust signals, data exfiltration to a backend store) without being a
pixel-perfect clone of any real company's login portal.

## Requirements

- **PHP 8.0+** (`php -v`) with the `pdo_mysql` extension.
- A **MySQL** database. You said you'll provide Render connection links — paste
  them via environment variables (below). Each site can use its own database or
  share one; the table names don't collide.

## Configure the database (your Render MySQL links)

Each site reads its connection from the environment. You can use **either** a
single connection URL **or** the individual variables.

Option A — one URL per site (recommended for Render):

```
# Windows PowerShell
$env:SITE1_DATABASE_URL = "mysql://user:pass@host:3306/site1db"
$env:SITE2_DATABASE_URL = "mysql://user:pass@host:3306/site2db"
$env:SITE3_DATABASE_URL = "mysql://user:pass@host:3306/site3db"
```

Option B — shared variables (used if the `*_DATABASE_URL` is not set):

```
$env:DB_HOST="host"; $env:DB_PORT="3306"; $env:DB_USER="user"; $env:DB_PASS="pass"; $env:DB_NAME="phish_lab"
```

If nothing is set it defaults to a local MySQL (`127.0.0.1:3306`, user `root`,
no password). Each site **creates its own table automatically** on first hit —
no manual import needed — but a `schema.sql` is included per site if you prefer
to create tables yourself.

## Run them (each on its own port)

```
php -S 127.0.0.1:8081 -t site1
php -S 127.0.0.1:8082 -t site2
php -S 127.0.0.1:8083 -t site3
```

Then open `http://localhost:8081`, `:8082`, `:8083`.

### Optional: a more phishing-looking local hostname

Real phishing has a deceptive hostname. To demo that locally **without exposing
anything to the internet**, add a hosts-file alias that still resolves to your
own machine, e.g. in `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1   secure-mail-login.test
127.0.0.1   streamforge-watch.test
```

Then browse `http://secure-mail-login.test:8081`. The site still only serves
locally; only the *name* looks suspicious (useful for the URL-classifier demo).

## site2 movie data (TMDB — "the free moviedb")

site2 pulls a real catalogue from **The Movie Database (TMDB)**. Get a free API
key at <https://www.themoviedb.org/settings/api> and set:

```
$env:TMDB_API_KEY = "your_tmdb_key"
```

Without a key, site2 still runs and shows a built-in fallback catalogue.

## Testing with CyberForge

1. Start CyberForge desktop and sign in.
2. Browse to the test sites in your monitored browser. The active-tab scanner
   picks up the URL you are viewing.
3. Submit **fake** credentials/data to exercise the harvest path, then check the
   captured rows in your MySQL DB (`SELECT * FROM captured_*`).

**Note on the cloud scraper:** CyberForge's page scraper (WebScrapper.live) runs
in the cloud and cannot reach `localhost`, so the deep content-scrape stage will
be empty for these local URLs. The URL-string classifier, DGA heuristic, and the
local browser-intelligence/telemetry layers still exercise end-to-end. Using the
`.test` hostnames above makes the URL look phishing-like for the classifier demo.

## Safety mechanisms built in

- **Localhost guard** — every page returns `403` off-loopback unless `ALLOW_REMOTE=1`.
- **Visible disclaimer** — a footer banner on every page marks it as a simulation.
- **No exfiltration** — captured data goes only to *your* MySQL; nothing is
  emailed or sent to any third party.
- **No evasion** — there is no bot/scanner cloaking; these are meant to be detected.
- **Prepared statements** — the backend stores data via parameterised PDO queries.

## Cleaning up

Drop the tables (or the databases) when you're done:

```sql
DROP TABLE IF EXISTS captured_credentials;  -- site1
DROP TABLE IF EXISTS captured_signups;      -- site2
DROP TABLE IF EXISTS captured_profiles;     -- site3
```
