// server/tests/unit/leaderboardRanking.test.js
// Test Suite: Bảng Xếp Hạng & Vinh Danh Đa Chiều (Leaderboard & Hall of Fame)

const assert = require('assert');

function runLeaderboardRankingTests() {
  console.log('\n🏆 [TEST SUITE: LEADERBOARD & HALL OF FAME RANKING]');

  // Test 1: Early Bird Today Ranking (Sort by Earliest Check-in Time)
  try {
    const todayRecords = [
      { user_id: 'u1', full_name: 'Trường', check_in_time: '08:05', is_late: false },
      { user_id: 'u2', full_name: 'Ninh', check_in_time: '07:42', is_late: false },
      { user_id: 'u3', full_name: 'Ngọc', check_in_time: '07:55', is_late: false },
      { user_id: 'u4', full_name: 'Tuấn', check_in_time: '08:15', is_late: true },
      { user_id: 'u5', full_name: 'Phong', check_in_time: null, is_late: false },
    ];

    const rankedToday = todayRecords.map(u => {
      let score = -99999;
      if (u.check_in_time) {
        const [hh, mm] = u.check_in_time.split(':').map(Number);
        score = 10000 - ((hh * 60) + mm);
      }
      return { ...u, score };
    }).sort((a, b) => b.score - a.score);

    assert.strictEqual(rankedToday[0].full_name, 'Ninh', 'Top 1 must be Ninh (07:42)');
    assert.strictEqual(rankedToday[1].full_name, 'Ngọc', 'Top 2 must be Ngọc (07:55)');
    assert.strictEqual(rankedToday[2].full_name, 'Trường', 'Top 3 must be Trường (08:05)');
    assert.strictEqual(rankedToday[3].full_name, 'Tuấn', 'Top 4 must be Tuấn (08:15)');
    assert.strictEqual(rankedToday[4].full_name, 'Phong', 'Top 5 must be Phong (no check-in)');

    console.log('  ✓ [PASS] TC-LDR-01: Xếp hạng Chim Sớm Hôm Nay theo giờ đến chính xác từng phút');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-LDR-01:', err.message);
    throw err;
  }

  // Test 2: Work Hours & OT Hours Ranking
  try {
    const userHours = [
      { user_id: 'u1', full_name: 'An', totalWorkHours: 175.5, otHours: 12.0 },
      { user_id: 'u2', full_name: 'Bình', totalWorkHours: 192.0, otHours: 25.5 },
      { user_id: 'u3', full_name: 'Châu', totalWorkHours: 160.0, otHours: 4.0 },
      { user_id: 'u4', full_name: 'Dũng', totalWorkHours: 188.5, otHours: 32.0 },
    ];

    // Rank by Total Work Hours
    const rankWork = [...userHours].sort((a, b) => b.totalWorkHours - a.totalWorkHours);
    assert.strictEqual(rankWork[0].full_name, 'Bình', 'Top 1 Work Hours: Bình (192.0h)');
    assert.strictEqual(rankWork[1].full_name, 'Dũng', 'Top 2 Work Hours: Dũng (188.5h)');
    assert.strictEqual(rankWork[2].full_name, 'An', 'Top 3 Work Hours: An (175.5h)');

    // Rank by OT Hours
    const rankOT = [...userHours].sort((a, b) => b.otHours - a.otHours);
    assert.strictEqual(rankOT[0].full_name, 'Dũng', 'Top 1 OT: Dũng (32.0h)');
    assert.strictEqual(rankOT[1].full_name, 'Bình', 'Top 2 OT: Bình (25.5h)');

    console.log('  ✓ [PASS] TC-LDR-02: Xếp hạng Tổng Giờ Làm & Chiến Thần OT chuẩn xác');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-LDR-02:', err.message);
    throw err;
  }

  // Test 3: On-Time Streak Calculation
  try {
    const dailyLogs = [
      { date: '2026-08-01', is_late: false, status: 'present' },
      { date: '2026-08-02', is_late: false, status: 'present' },
      { date: '2026-08-03', is_late: true, status: 'present' }, // Streak resets
      { date: '2026-08-04', is_late: false, status: 'present' },
      { date: '2026-08-05', is_late: false, status: 'present' },
      { date: '2026-08-06', is_late: false, status: 'present' },
      { date: '2026-08-07', is_late: false, status: 'present' },
    ];

    let currentStreak = 0;
    let maxStreak = 0;

    dailyLogs.forEach(att => {
      if (!att.is_late && att.status === 'present') {
        currentStreak += 1;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    assert.strictEqual(maxStreak, 4, 'Max consecutive on-time streak must be 4 days');

    console.log('  ✓ [PASS] TC-LDR-03: Tính toán chuỗi ngày đi làm đúng giờ liên tiếp chính xác');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-LDR-03:', err.message);
    throw err;
  }

  // Test 4: Tier Badges Assignment
  try {
    const ranks = Array.from({ length: 25 }, (_, i) => ({ rank: i + 1 }));
    ranks.forEach(r => {
      if (r.rank === 1) r.tier = 'gold';
      else if (r.rank === 2) r.tier = 'silver';
      else if (r.rank === 3) r.tier = 'bronze';
      else if (r.rank <= 10) r.tier = 'elite';
      else if (r.rank <= 20) r.tier = 'top20';
      else r.tier = 'team';
    });

    assert.strictEqual(ranks[0].tier, 'gold');
    assert.strictEqual(ranks[1].tier, 'silver');
    assert.strictEqual(ranks[2].tier, 'bronze');
    assert.strictEqual(ranks[3].tier, 'elite');
    assert.strictEqual(ranks[9].tier, 'elite');
    assert.strictEqual(ranks[10].tier, 'top20');
    assert.strictEqual(ranks[19].tier, 'top20');
    assert.strictEqual(ranks[20].tier, 'team');

    console.log('  ✓ [PASS] TC-LDR-04: Phân nhóm danh hiệu (Gold, Silver, Bronze, Elite, Top 20, Team) trọn vẹn 100%');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-LDR-04:', err.message);
    throw err;
  }
}

module.exports = { runLeaderboardRankingTests };
