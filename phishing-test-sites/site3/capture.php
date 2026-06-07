<?php
/**
 * site3 (CloudVault) — receive the "sign in to view document" credentials, store
 * them to the lab's own capture store, then send the visitor to the educational
 * debrief. Captured input is never validated or used against any real service.
 */
require __DIR__ . '/lib.php';
require_local();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: index.php'); exit; }

capture_and_debrief('doc-share', [
    'email'    => trim($_POST['email'] ?? ''),
    'password' => (string)($_POST['password'] ?? ''),
    'extra'    => ['document' => substr($_POST['extra'] ?? '', 0, 120)],
]);
