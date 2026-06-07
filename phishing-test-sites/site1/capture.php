<?php
/**
 * site1 (PrimeReel) — receive the fake "Google sign-in", store it to the lab's
 * own capture store, then send the visitor to the educational debrief. Captured
 * input is never validated or used against any real service.
 */
require __DIR__ . '/lib.php';
require_local();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: index.php'); exit; }

capture_and_debrief('google-oauth', [
    'email'    => trim($_POST['email'] ?? ''),
    'password' => (string)($_POST['password'] ?? ''),
    'extra'    => ['app' => 'PrimeReel', 'title' => substr($_POST['title'] ?? '', 0, 120)],
]);
