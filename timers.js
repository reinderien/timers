/*
Independent variables:
    bit width
    input frequency
    pre-scale
    post-scale
    time

Dependent variables:
    value
    resolution
    error

value * scale = time * freq

0 < value < 2^bits
0 < time * freq / scale < 2^bits
log_2(time * freq / scale) < bits

time_ideal = value * scale / freq
time_act = round(value) * scale / freq
error = time_act / time_ideal - 1

resolution time = time for value=1
                = scale / freq

scale/time         < freq  < scale/time * 2^bits
time*freq / 2^bits < scale < time*freq
scale/freq         < time  < scale/freq * 2^bits
log_2(time * freq / scale) < bits


PIC18F66K40 timer 0:
    8 or 16 bit mode
    freq: sosc, lfintosc, hfintosc, fosc/4
          na    31khz               na
                          1,2,4,8,12,16,32,48,64 MHz
    scale: 1-16 postscale, 2**(0-15) prescale

For a first example, plot scale product on horizontal,
                          freq on vertical,
                          for t = 1ms, bits = 16
                          points for min on max in both dimensions.
*/

(function() {

// initialised on parse
var time, valueMax, availFreq, allScales, graph;

const 
    feasibilityPoints = [],
    implementationPoints = [],
    scaleLabels = [];

function fillFeasibilityPoints() {
    feasibilityPoints.length = 0;

    const 
        freqBottom = Math.min(...availFreq),
        freqTop    = Math.max(...availFreq),
        scaleLeft  = Math.min(...allScales),
        scaleRight = Math.max(...allScales);

    const
        freqSW = scaleLeft/time,
        freqSE = scaleRight/time,
        freqNW = freqSW * valueMax,
        freqNE = freqSE * valueMax;
        
    if (freqSW < freqBottom) {
        var scaleSW = freqBottom*time / valueMax;
        if (scaleSW < scaleLeft) {
            scaleSW = scaleLeft;
            if (freqNW < freqTop) {
                feasibilityPoints.push(
                    // west corner (obtuse)
                    {y: scaleLeft/time * valueMax, x: scaleLeft}
                );
            }
        }

        feasibilityPoints.push(
            // southwest corner (square)
            {y: freqBottom, x: scaleSW},
            // southeast corner (obtuse)
            {y: freqBottom, x: Math.min(scaleRight, freqBottom*time)},
        );
    }
    else {
        feasibilityPoints.push(
            // southwest corner (acute)
            {y: freqSW, x: scaleLeft}
        );
    }
    
    if (freqNE > freqTop) {
        var scaleNE = freqTop*time;
        if (scaleNE > scaleRight) {
            scaleNE = scaleRight;
            if (freqSE > freqBottom) {
                feasibilityPoints.push(
                    // east corner (obtuse)
                    {y: scaleRight/time, x: scaleRight}
                );
            }
        }

        feasibilityPoints.push(
            // northeast corner (square)
            {y: freqTop, x: scaleNE},
            // northwest corner (obtuse)
            {y: freqTop, x: Math.max(scaleLeft,  freqTop*time / valueMax)},
        );
    }
    else {
        feasibilityPoints.push(
            // northeast corner (acute)
            {y: freqNE, x: scaleRight}
        );
    }
    
    // close loop
    feasibilityPoints.push(feasibilityPoints[0]);
}

function fillImplementationPoints() {
    implementationPoints.length = 0;

    implementationPoints.push(
        ...availFreq.flatMap(
            freq => {
                // We could do a naive filter(), but that doesn't capture the fact that there will be:
                //   0 or more out-of-range,
                //   0 or more in-range, and then
                //   0 or more out-of-range, in that order.
                // The best approach to finding both bounds would be a bisection, but isn't built into JS.
                // Whatever.
                const row = [],
                    scaleMax = time*freq,
                    scaleMin = scaleMax / valueMax, 
                    start = allScales.findIndex(
                        scale =>  scale >= scaleMin
                    );

                if (start != -1) {
                    allScales.slice(start).every(scale => {
                        if (scale > scaleMax)
                            return false;
                        row.push({x: scale, y: freq});
                        return true;
                    });
                }
                return row;
            }
        )
    );
}

function fillScaleLabels() {
    scaleLabels.length = 0;
    scaleLabels.push(
        ...new Set(
            feasibilityPoints
            .concat(implementationPoints)
            .map(xy => xy.x)
        )
    );
}

function makeTooltipCallback() {
    const 
        locale=undefined,
        freqFmt = new Intl.NumberFormat(
            locale, {
                notation: 'engineering', style: 'decimal', useGrouping: false,
            }
        ),
        timeFmt = new Intl.NumberFormat(
            locale, {
                notation: 'engineering', style: 'decimal', useGrouping: false,
            }
        ),
        scaleFmt = new Intl.NumberFormat(
            locale, {
                notation: 'standard', style: 'decimal', useGrouping: true,
            }
        ),
        timerFmt = scaleFmt,
        errorFmt = new Intl.NumberFormat(
            locale, {
                notation: 'scientific', style: 'decimal', useGrouping: true,
            }
        );

    return items => items.flatMap(item => {
        const 
            scale = item.parsed.x,
            freq = item.parsed.y,
            valueIdeal = -time * freq / scale;

        if (item.dataset.label == 'Feasible frequency region')
            return [
                'Scale limit: ' + scaleFmt.format(scale),
                'Timer limit: ' + timerFmt.format(valueIdeal),
            ];
        
        const valueActual = Math.round(valueIdeal),
            timeActual = -valueActual * scale / freq,
            error = timeActual/time - 1;
        return [
            'f = ' + freqFmt.format(freq) + ' Hz',
            'scale = ' + scaleFmt.format(scale),
            'tmr_idl = ' + timerFmt.format(valueIdeal),
            'tmr_act = ' + timerFmt.format(valueActual),
            't_idl = ' + timeFmt.format(time) + ' s',
            't_act = ' + timeFmt.format(timeActual) + ' s',
            'rel_err = ' + errorFmt.format(error),
        ];
    });
}

const config = {
    options: {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: 'Feasible timer parameter space'
            },
            tooltip: {
                callbacks: {
                    title: makeTooltipCallback()
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'scale'
                },
                type: 'logarithmic'
            },
            y: {
                title: {
                    display: true,
                    text: 'freq'
                },
                type: 'logarithmic'
            }
        },
    },
    data: {
        datasets: [
            {
                label: 'Feasible frequency region',
                type: 'line',
                borderColor: '#cbeac9',
                data: feasibilityPoints,
                order: 2
            },
            {
                label: 'Implementable',
                type: 'scatter',
                borderColor: '#75a6d1',
                data: implementationPoints,
                order: 1
            }
        ],
        labels: scaleLabels
    }
};

function updateGraph() {
    fillFeasibilityPoints();
    fillImplementationPoints();
    fillScaleLabels();
    graph.update();
}

function attachHandlers() {
    const timeInput = document.getElementById('time');
    const bitsInput = document.getElementById('bits');
    const freqInput = document.getElementById('freq');

    function parseTime() {
        time = parseFloat(timeInput.value);
    }
    function parseBits() {
        const bits = parseInt(bitsInput.value);
        valueMax = 2**bits - 1;
    }
    function parseFreq() {
        availFreq = freqInput.value.split(',').map(parseFloat);
    }
    function parseScale() {
        allScales = [1, 2, 4, 8, 16];
    }

    timeInput.addEventListener(
        'change', () => {parseTime(); updateGraph()});
    bitsInput.addEventListener(
        'change', () => {parseBits(); updateGraph()});
    freqInput.addEventListener(
        'change', () => {parseFreq(); updateGraph()});
    [
        'scale1', 'scale2',
        'scale3_exp', 'scale3_min', 'scale3_max',
        'scale4_exp', 'scale4_min', 'scale4_max',
    ].forEach(id =>
        document.getElementById(id).addEventListener(
            'change', () => {parseScale(); updateGraph()})
    );
    
    parseTime();
    parseBits();
    parseFreq();
    parseScale();
}

window.onload = function () {
    const ctx = document.getElementById('chart').getContext('2d');
    graph = new Chart(ctx, config);
    attachHandlers();
    updateGraph();
};

})();
