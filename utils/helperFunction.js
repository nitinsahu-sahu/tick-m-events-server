function calculateDuration(start, end) {
    const diffMs = end - start;
    const diffSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    
    return { hours, minutes, seconds };
}

function addDurations(duration1, duration2) {
    let seconds = duration1.seconds + duration2.seconds;
    let minutes = duration1.minutes + duration2.minutes;
    let hours = duration1.hours + duration2.hours;
    
    if (seconds >= 60) {
        minutes += Math.floor(seconds / 60);
        seconds = seconds % 60;
    }
    
    if (minutes >= 60) {
        hours += Math.floor(minutes / 60);
        minutes = minutes % 60;
    }
    
    return { hours, minutes, seconds };
}