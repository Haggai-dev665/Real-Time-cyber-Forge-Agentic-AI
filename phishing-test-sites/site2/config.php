<?php
/**
 * site2 — database + TMDB configuration.
 * Set SITE2_DATABASE_URL (mysql://user:pass@host:port/dbname) or the DB_* vars
 * for your Render MySQL. Set TMDB_API_KEY for the real movie catalogue.
 */
return [
    'database_url'  => getenv('SITE2_DATABASE_URL') ?: (getenv('DATABASE_URL') ?: ''),
    'db_host'       => getenv('DB_HOST') ?: '127.0.0.1',
    'db_port'       => getenv('DB_PORT') ?: '3306',
    'db_name'       => getenv('DB_NAME') ?: 'phish_site2',
    'db_user'       => getenv('DB_USER') ?: 'root',
    'db_pass'       => getenv('DB_PASS') ?: '',
    'allow_remote'  => getenv('ALLOW_REMOTE') === '1',
    'tmdb_api_key'  => getenv('TMDB_API_KEY') ?: '',
];
