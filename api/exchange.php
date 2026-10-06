<?php
declare(strict_types=1);

const EXCHANGE_SOURCE = 'https://api.frankfurter.dev/v2/rates?base=USD&providers=ecb';

function normalize_exchange_rates(array $response): array {
    $rates = ['USD'=>1.0];
    $dates = [];
    foreach ($response as $row) {
        if (!is_array($row) || ($row['base'] ?? null) !== 'USD'
            || !preg_match('/^[A-Z]{3}$/', $row['quote'] ?? '')
            || !is_numeric($row['rate'] ?? null) || !is_finite((float)$row['rate']) || $row['rate'] <= 0
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $row['date'] ?? '')) continue;
        $rates[$row['quote']] = (float)$row['rate'];
        $dates[$row['quote']] = $row['date'];
    }
    $rates['USD'] = 1.0;
    ksort($rates);
    return ['rates'=>$rates,'dates'=>$dates];
}

function cached_exchange_rates(?string $directory = null): array {
    $directory ??= getenv('MINERODDS_CACHE_DIR') ?: dirname(__DIR__).'/var/cache';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) throw new RuntimeException('Cache directory cannot be created.');
    $lock = fopen($directory.'/exchange.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Exchange cache lock unavailable.');
    try {
        $file = $directory.'/exchange.json';
        $old = is_file($file) ? json_decode(file_get_contents($file), true) : [];
        if (!is_array($old)) $old = [];
        if (($old['attempted_at'] ?? 0) > time() - CACHE_TTL) return $old;
        $snapshot = array_merge(['rates'=>['USD'=>1.0],'dates'=>[]], $old,
            ['attempted_at'=>time(),'next_refresh'=>time()+CACHE_TTL,'source'=>EXCHANGE_SOURCE]);
        // Persist failed attempts too, independently of the mining data cache.
        if (file_put_contents($file, json_encode($snapshot, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Exchange cache is not writable.');
        $response = fetch_sources(['exchange'=>EXCHANGE_SOURCE])['exchange'];
        if ($response) {
            $normalized = normalize_exchange_rates($response);
            if (count($normalized['rates']) > 1) $snapshot = array_merge($snapshot, $normalized, ['updated_at'=>time()]);
        }
        $temp = $file.'.tmp';
        if (file_put_contents($temp, json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)) === false || !rename($temp, $file)) throw new RuntimeException('Exchange cache write failed.');
        return $snapshot;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
