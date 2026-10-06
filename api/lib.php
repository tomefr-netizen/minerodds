<?php
declare(strict_types=1);

const CACHE_TTL = 86400;

function coin_catalog(): array {
    return [
        ['symbol'=>'BTC','name'=>'Bitcoin','slug'=>'btc','market'=>'Bitcoin','type'=>'Direct','note'=>'SHA-256d proof of work.'],
        ['symbol'=>'BCH','name'=>'Bitcoin Cash','slug'=>'bch','market'=>'BitcoinCash','type'=>'Direct','note'=>'SHA-256d proof of work.'],
        ['symbol'=>'DGB','name'=>'DigiByte','slug'=>'dgb','market'=>'DGB-SHA','type'=>'Multi-algorithm','note'=>'Only the SHA-256d difficulty is used. The target interval for this algorithm is 75 seconds.'],
        ['symbol'=>'XEC','name'=>'eCash','slug'=>'xec','market'=>'Ecash','type'=>'Direct','note'=>'Rewards use XEC units, not BTC units.'],
        ['symbol'=>'BC2','name'=>'Bitcoin II','slug'=>'bc2','market'=>'BitcoinII','type'=>'Direct','note'=>'Small chain. Check liquidity and compatible pools before mining.'],
        ['symbol'=>'BCH2','name'=>'Bitcoin Cash II','slug'=>'bch2','market'=>'BitcoinCashII','type'=>'Direct','note'=>'Small chain. Check liquidity and compatible pools before mining.'],
        ['symbol'=>'PPC','name'=>'Peercoin','slug'=>'ppc','market'=>'Peercoin','type'=>'Hybrid PoW / PoS','note'=>'These estimates use proof-of-work difficulty only. Rewards vary with difficulty.'],
        ['symbol'=>'NMC','name'=>'Namecoin','slug'=>'nmc','market'=>'Namecoin','type'=>'Merged mining','note'=>'Requires an AuxPoW-capable pool or setup. Revenue is not automatically included with Bitcoin.'],
    ];
}

function number_value(mixed $value): ?float {
    if (is_numeric($value)) return (float)$value;
    if (!is_string($value)) return null;
    if (!preg_match('/^([0-9,.]+)\s*([kMGTPE]?)$/', trim($value), $match)) return null;
    $multipliers = [''=>1,'k'=>1e3,'M'=>1e6,'G'=>1e9,'T'=>1e12,'P'=>1e15,'E'=>1e18];
    return (float)str_replace(',', '', $match[1]) * $multipliers[$match[2]];
}

function fetch_sources(array $urls): array {
    $multi = curl_multi_init();
    $handles = [];
    foreach ($urls as $key=>$url) {
        $h = curl_init($url);
        curl_setopt_array($h, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>4,
            CURLOPT_TIMEOUT=>12, CURLOPT_USERAGENT=>'MinerOdds/0.1 (daily cached mining comparison)',
            CURLOPT_FOLLOWLOCATION=>false, CURLOPT_MAXFILESIZE=>2000000]);
        curl_multi_add_handle($multi, $h);
        $handles[$key] = $h;
    }
    do {
        curl_multi_exec($multi, $running);
        if ($running) curl_multi_select($multi, 0.5);
    } while ($running);
    $result = [];
    foreach ($handles as $key=>$h) {
        $body = curl_multi_getcontent($h);
        $value = curl_getinfo($h, CURLINFO_RESPONSE_CODE) === 200 ? json_decode($body, true) : null;
        $result[$key] = is_array($value) && !isset($value['error']) ? $value : null;
        curl_multi_remove_handle($multi, $h);
    }
    curl_multi_close($multi);
    return $result;
}

function refresh_snapshot(array $previous): array {
    $urls = ['pool'=>'https://bcmonster.com/api/v1/pool_info'];
    foreach (coin_catalog() as $coin) {
        if (!in_array($coin['symbol'], ['PPC','NMC'])) $urls[$coin['symbol'].':chain'] = 'https://solofury.com/api/blockinfo/'.$coin['slug'].'/stats';
        $urls[$coin['symbol'].':market'] = 'https://backpow.com/coins-data/'.$coin['market'].'.json';
    }
    $sources = fetch_sources($urls);
    $old = array_column($previous['coins'] ?? [], null, 'symbol');
    $now = time();
    $coins = [];
    foreach (coin_catalog() as $meta) {
        $symbol = $meta['symbol'];
        $coin = array_merge($old[$symbol] ?? [], $meta);
        $chain = $sources[$symbol.':chain'] ?? null;
        $market = $sources[$symbol.':market'];
        $pool = null;
        foreach ($sources['pool'] ?? [] as $entry) if (($entry['coin'] ?? '') === $symbol) $pool = $entry;
        $difficulty = number_value($chain['difficulty'] ?? $pool['network_difficulty'] ?? null);
        if ($difficulty !== null && $difficulty > 0) {
            $coin['difficulty'] = $difficulty;
            $coin['network_updated'] = $now;
            $coin['network_source'] = $chain ? 'https://solofury.com/api/blockinfo/'.$meta['slug'].'/stats' : 'https://bcmonster.com/api.html';
            $coin['height'] = $chain['tip'] ?? null;
            $coin['block_seconds'] = $chain['expected_interval_s'] ?? null;
            $coin['network_hashrate'] = $chain['hashrate_est_hs'] ?? $pool['network_hashrate'] ?? null;
            $coin['hashrate_estimated'] = (bool)$chain;
        }
        if ($chain && is_numeric($chain['avg_gross_100_sat'] ?? null) && is_numeric($chain['decimals'] ?? null)) {
            $coin['reward'] = $chain['avg_gross_100_sat'] / (10 ** $chain['decimals']);
            $coin['reward_updated'] = $now;
            $coin['reward_source'] = $coin['network_source'];
        } elseif ($market && ($reward = number_value($market['Bl. reward'] ?? null)) !== null && $reward > 0) {
            $coin['reward'] = $reward;
            $coin['reward_updated'] = $now;
            $coin['reward_source'] = 'https://backpow.com/'.$meta['market'];
        }
        if ($market && is_numeric($market['usdPrice'] ?? null) && $market['usdPrice'] > 0) {
            $coin['price'] = (float)$market['usdPrice'];
            $coin['price_updated'] = $now;
            $coin['price_source'] = 'https://backpow.com/'.$meta['market'];
            $coin['volume_usd'] = $market['volume24hUsd'] ?? null;
        }
        $coin['available'] = isset($coin['difficulty']) && $coin['difficulty'] > 0;
        $coin['stale'] = !$difficulty || ($coin['network_updated'] ?? 0) < $now - CACHE_TTL;
        $coin['price_stale'] = !$market || ($coin['price_updated'] ?? 0) < $now - CACHE_TTL;
        $coin['reward_stale'] = ($coin['reward_updated'] ?? 0) < $now - CACHE_TTL;
        $coins[] = $coin;
    }
    return ['attempted_at'=>$now, 'next_refresh'=>$now+CACHE_TTL, 'coins'=>$coins];
}

function cached_snapshot(?string $directory = null): array {
    // The lock and attempt timestamp also limit retries when an upstream fails.
    $directory ??= getenv('MINERODDS_CACHE_DIR') ?: dirname(__DIR__).'/var/cache';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) throw new RuntimeException('Cache directory cannot be created.');
    $lock = fopen($directory.'/refresh.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Cache lock unavailable.');
    try {
        $file = $directory.'/snapshot.json';
        $old = is_file($file) ? json_decode(file_get_contents($file), true) : [];
        if (!is_array($old)) $old = [];
        if (($old['attempted_at'] ?? 0) > time() - CACHE_TTL) return $old;
        // Record the attempt before I/O so interrupted requests cannot cause a retry storm.
        $pending = array_merge($old, ['attempted_at'=>time(), 'next_refresh'=>time()+CACHE_TTL]);
        if (file_put_contents($file, json_encode($pending, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Cache is not writable.');
        $snapshot = refresh_snapshot($old);
        $temp = $file.'.tmp';
        if (file_put_contents($temp, json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)) === false || !rename($temp, $file)) throw new RuntimeException('Cache write failed.');
        return $snapshot;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
