<?php
declare(strict_types=1);
require __DIR__.'/lib.php';
require __DIR__.'/exchange.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $snapshot = cached_snapshot();
    foreach ($snapshot['coins'] as &$coin) {
        $coin['stale'] = ($coin['network_updated'] ?? 0) < time() - CACHE_TTL;
        $coin['price_stale'] = ($coin['price_updated'] ?? 0) < time() - CACHE_TTL;
        $coin['reward_stale'] = ($coin['reward_updated'] ?? 0) < time() - CACHE_TTL;
    }
    unset($coin);
    try {
        $snapshot['exchange'] = cached_exchange_rates();
        $snapshot['exchange']['stale'] = ($snapshot['exchange']['updated_at'] ?? 0) < time() - CACHE_TTL;
    } catch (Throwable $error) {
        error_log('MinerOdds exchange: '.$error->getMessage());
        $snapshot['exchange'] = ['rates'=>['USD'=>1.0], 'dates'=>[], 'stale'=>true];
    }
    echo json_encode($snapshot, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log('MinerOdds: '.$error->getMessage());
    http_response_code(503);
    echo json_encode(['error'=>'Mining data is unavailable. Please try again later.']);
}
