<?php
/**
 * site1 — database configuration.
 * Paste your Render MySQL details via environment variables. Either set
 * SITE1_DATABASE_URL (mysql://user:pass@host:port/dbname) or the DB_* vars.
 * Defaults target a local MySQL so it works out of the box for testing.
 */
return [
    'database_url' => getenv('SITE1_DATABASE_URL') ?: (getenv('DATABASE_URL') ?: ''),
    'db_host'      => getenv('DB_HOST') ?: 'sql112.infinityfree.com',
    'db_port'      => getenv('DB_PORT') ?: '3306',
    'db_name'      => getenv('DB_NAME') ?: 'if0_42116506_test1',
    'db_user'      => getenv('DB_USER') ?: 'if0_42116506',
    'db_pass'      => getenv('DB_PASS') ?: '7724W9LeQjeqPh',
    'allow_remote' => getenv('ALLOW_REMOTE') === '1',
];
