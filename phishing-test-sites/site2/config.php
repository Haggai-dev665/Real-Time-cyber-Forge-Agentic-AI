<?php
/**
 * site2 — "SoftHub" free-software portal (steals credentials before download).
 * Shares the InfinityFree DB with the other sites (rows tagged by `site`);
 * override via env. `dash_key` guards dashboard.php.
 */
return [
    'site'         => 'site2',
    'site_name'    => 'SoftHub',
    'dash_key'     => getenv('DASH_KEY') ?: 'cf-demo-2026',
    'database_url' => getenv('SITE2_DATABASE_URL') ?: (getenv('DATABASE_URL') ?: ''),
    'db_host'      => getenv('DB_HOST') ?: 'sql112.infinityfree.com',
    'db_port'      => getenv('DB_PORT') ?: '3306',
    'db_name'      => getenv('DB_NAME') ?: 'if0_42116506_test1',
    'db_user'      => getenv('DB_USER') ?: 'if0_42116506',
    'db_pass'      => getenv('DB_PASS') ?: '7724W9LeQjeqPh',
    'allow_remote' => getenv('ALLOW_REMOTE') !== '0',
];
