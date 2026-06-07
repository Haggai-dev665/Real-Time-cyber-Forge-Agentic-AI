<?php
/**
 * site1 — "PrimeReel" free-movie site (fake Google sign-in on Watch).
 * DB details are pre-filled for the InfinityFree account; override via env.
 * `tmdb_key` is optional: with it the catalog loads live from TMDB (client-side);
 * without it a bundled fallback catalog is shown. `dash_key` guards dashboard.php.
 */
return [
    'site'         => 'site1',
    'site_name'    => 'PrimeReel',
    'tmdb_key'     => getenv('TMDB_API_KEY') ?: '',          // TMDB v3 API key (optional)
    'dash_key'     => getenv('DASH_KEY') ?: 'cf-demo-2026',  // dashboard.php?key=...
    'database_url' => getenv('SITE1_DATABASE_URL') ?: (getenv('DATABASE_URL') ?: ''),
    'db_host'      => getenv('DB_HOST') ?: 'sql112.infinityfree.com',
    'db_port'      => getenv('DB_PORT') ?: '3306',
    'db_name'      => getenv('DB_NAME') ?: 'if0_42116506_test1',
    'db_user'      => getenv('DB_USER') ?: 'if0_42116506',
    'db_pass'      => getenv('DB_PASS') ?: '7724W9LeQjeqPh',
    'allow_remote' => getenv('ALLOW_REMOTE') !== '0',        // default TRUE — hosting the demo is the goal
];
