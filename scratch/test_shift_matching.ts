// Simulation of shift matching logic
function testMatching() {
    const empDayShifts = [
        { id: 'shift-9am', start_time: '09:00:00', end_time: '17:00:00' },
        { id: 'shift-10pm', start_time: '22:30:00', end_time: '02:00:00' }
    ];

    const logs = [
        { timestamp: '2026-04-20T13:04:00Z', note: 'Session 1' },
        { timestamp: '2026-04-20T22:32:00Z', note: 'Session 2' }
    ];

    const results = logs.map(log => {
        const iDate = new Date(log.timestamp);
        let bestShift = null;
        let minDiff = Infinity;

        for (const s of empDayShifts) {
            // New logic
            const sStart = new Date(iDate);
            const [h, m] = s.start_time.split(':').map(Number);
            sStart.setHours(h, m, 0, 0);
            
            let diff = Math.abs(iDate.getTime() - sStart.getTime());
            
            if (diff > 12 * 60 * 60 * 1000) {
              const diffPrev = Math.abs(iDate.getTime() - (sStart.getTime() - 24 * 60 * 60 * 1000))
              const diffNext = Math.abs(iDate.getTime() - (sStart.getTime() + 24 * 60 * 60 * 1000))
              if (diffPrev < diff) diff = diffPrev
              if (diffNext < diff) diff = diffNext
            }

            if (diff < minDiff) {
                minDiff = diff;
                bestShift = s;
            }
        }
        return { log: log.timestamp, bestShift: bestShift?.id, minDiffMins: minDiff / 60000 };
    });

    console.log(JSON.stringify(results, null, 2));
}

testMatching();
