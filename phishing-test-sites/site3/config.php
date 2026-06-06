<?php
/**
 * site3 — database configuration.
 * Set SITE3_DATABASE_URL (mysql://user:pass@host:port/dbname) or the DB_* vars
 * for your Render MySQL. Defaults to a local MySQL for out-of-the-box testing.
 */
return [
    'database_url' => getenv('SITE3_DATABASE_URL') ?: (getenv('DATABASE_URL') ?: ''),
    'db_host'      => getenv('DB_HOST') ?: '127.0.0.1',
    'db_port'      => getenv('DB_PORT') ?: '3306',
    'db_name'      => getenv('DB_NAME') ?: 'phish_site3',
    'db_user'      => getenv('DB_USER') ?: 'root',
    'db_pass'      => getenv('DB_PASS') ?: '',
    'allow_remote' => getenv('ALLOW_REMOTE') === '1',
];
