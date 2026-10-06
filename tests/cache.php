<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/lib.php';
require dirname(__DIR__).'/api/exchange.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
check(number_value('132,716,002M') === 132716002000000.0, 'Difficulty suffix conversion');
check(number_value('invalid') === null, 'Invalid number rejection');
$fx = normalize_exchange_rates([
    ['base'=>'USD','quote'=>'SEK','rate'=>10,'date'=>'2026-10-05'],
    ['base'=>'USD','quote'=>'USD','rate'=>9,'date'=>'2026-10-05'],
    ['base'=>'EUR','quote'=>'GBP','rate'=>2,'date'=>'2026-10-05'],
    ['base'=>'USD','quote'=>'EUR','rate'=>-1,'date'=>'2026-10-05'],
    ['base'=>'USD','quote'=>'BAD','rate'=>0,'date'=>'2026-10-05'],
]);
check($fx['rates'] === ['SEK'=>10.0,'USD'=>1.0], 'Exchange rates must validate base, code and positive values');
$directory = sys_get_temp_dir().'/minerodds-cache-test-'.bin2hex(random_bytes(6));
mkdir($directory);
try {
    $fixture = ['attempted_at'=>time(),'next_refresh'=>time()+CACHE_TTL,'coins'=>[['symbol'=>'TEST']]];
    $file = $directory.'/snapshot.json';
    file_put_contents($file,json_encode($fixture));
    $before = hash_file('sha256',$file);
    check(cached_snapshot($directory) === $fixture, 'Fresh snapshot must be returned unchanged');
    check(hash_file('sha256',$file) === $before, 'Repeated visits must not rewrite the cache');
    check(cached_snapshot($directory) === $fixture, 'Second visit must reuse the same snapshot');
    $exchange = ['attempted_at'=>time(),'rates'=>['USD'=>1.0,'SEK'=>10.0],'dates'=>['SEK'=>'2026-10-05'],'updated_at'=>time()];
    $exchangeFile = $directory.'/exchange.json';
    file_put_contents($exchangeFile,json_encode($exchange, JSON_PRESERVE_ZERO_FRACTION));
    $beforeExchange = hash_file('sha256',$exchangeFile);
    check(cached_exchange_rates($directory) === $exchange, 'Fresh exchange snapshot must be reused');
    check(hash_file('sha256',$exchangeFile) === $beforeExchange, 'Currency cache must not be rewritten on repeated visits');
    $failedExchange = ['attempted_at'=>time(),'rates'=>['USD'=>1.0],'dates'=>[]];
    file_put_contents($exchangeFile,json_encode($failedExchange, JSON_PRESERVE_ZERO_FRACTION));
    check(cached_exchange_rates($directory) === $failedExchange, 'Failed exchange attempts must also honor the daily limit');
    check(hash_file('sha256',$file) === $before, 'Exchange reads must not refresh mining data');
    echo "Daily mining/exchange caches, failed retry limit and normalization checks passed.\n";
} finally {
    foreach (glob($directory.'/*') as $file) unlink($file);
    rmdir($directory);
}
