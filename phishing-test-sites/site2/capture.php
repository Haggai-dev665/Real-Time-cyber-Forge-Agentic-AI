<?php
/**
 * site2 (SoftHub) — receive the "sign in to download" credentials, store them to
 * the lab's own capture store, then send the visitor to the educational debrief.
 * Captured input is never validated or used against any real service.
 */
require __DIR__ . '/lib.php';
require_local();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: index.php'); exit; }

capture_and_debrief('software-download', [
    'email'    => trim($_POST['email'] ?? ''),
    'password' => (string)($_POST['password'] ?? ''),
    'extra'    => ['app' => substr($_POST['app'] ?? '', 0, 60), 'software' => substr($_POST['appname'] ?? '', 0, 80)],
]);
