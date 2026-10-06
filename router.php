<?php
// Router for the local PHP development server.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/(var|tests)(/|$)#', $path) || preg_match('#/(\.git|\.env)(\.|/|$)#', $path) || in_array($path, ['/api/lib.php','/api/exchange.php','/router.php'])) {
    http_response_code(404);
    exit;
}
return false;
