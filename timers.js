(function() {

"use strict";

// initialised on parse
var time, valueMax, availFreq, allScales, 
    scaleFreqGraph, scaleValueGraph, valueFreqGraph;

// these references stay in-place and associated to the graph config;
// their contents are discarded and replaced on update
const
    feasiblePoints = [],
    implPoints = [];

function sortPredicate(a, b) { return a - b; }

function makePoint(freq, scale) {
    const valueIdeal = time * freq / scale;
    return {
        scale: scale,
        freq: freq,
        valueIdeal: valueIdeal,
        valueActual: Math.round(valueIdeal),
    };
}

function fillFeasiblePoints() {
    feasiblePoints.length = 0;

    const
        freqBottom = Math.min(...availFreq), scaleLeft  = Math.min(...allScales),
        freqTop    = Math.max(...availFreq), scaleRight = Math.max(...allScales);

    const
        freqSW = scaleLeft/time,  freqNW = freqSW * valueMax,
        freqSE = scaleRight/time, freqNE = freqSE * valueMax;

    function fillSymmetric(
        sign,
        freqAcute, freqObtuse,
        freqCloseLimit, freqFarLimit,
        scaleCloseLimit, scaleFarLimit,
        growFactor, shrinkFactor
    ) {
        if (freqAcute > freqFarLimit)
            return false;  // No feasible region

        if (freqAcute < freqCloseLimit) {
            var scaleCorner = freqCloseLimit*time / shrinkFactor;
            if (scaleCorner < scaleCloseLimit) {
                scaleCorner = scaleCloseLimit;
                if (freqObtuse < freqFarLimit) {
                    feasiblePoints.push(
                        // First obtuse corner
                        makePoint(sign * scaleCloseLimit/time * shrinkFactor, sign * scaleCloseLimit)
                    );
                }
            }

            feasiblePoints.push(
                // Square corner
                makePoint(sign * freqCloseLimit, sign * scaleCorner),
                // Second obtuse corner
                makePoint(sign * freqCloseLimit, sign * Math.min(scaleFarLimit, freqCloseLimit*time / growFactor)),
            );
        }
        else {
            feasiblePoints.push(
                // Corner (acute)
                makePoint(sign * freqAcute, sign * scaleCloseLimit)
            );
        }

        return true;
    }

    if (!fillSymmetric(
        1,                      // sign
        freqSW, freqNW,         // freqAcute, freqObtuse
        freqBottom, freqTop,    // freqCloseLimit, freqFarLimit
        scaleLeft, scaleRight,  // scaleCloseLimit, scaleFarLimit
        1, valueMax,            // growFactor, shrinkFactor
    )) return;

    if (!fillSymmetric(
        -1,                      // sign
        -freqNE, -freqSE,        // freqAcute, freqObtuse
        -freqTop, -freqBottom,   // freqCloseLimit, freqFarLimit
        -scaleRight, -scaleLeft, // scaleCloseLimit, scaleFarLimit
        valueMax, 1,             // growFactor, shrinkFactor
    )) {
        feasiblePoints.length = 0;
        return;
    }

    // close loop
    feasiblePoints.push(feasiblePoints[0]);
}

function fillImplPoints() {
    implPoints.length = 0;
    availFreq.forEach(
        freq => {
            // We could do a naive filter(), but that doesn't capture the fact that there will be:
            //   0 or more out-of-range,
            //   0 or more in-range, and then
            //   0 or more out-of-range, in that order.
            // The best approach to finding both bounds would be a bisection, but isn't built into JS.
            // Whatever.
            const
                scaleMax = time*freq,
                scaleMin = scaleMax / valueMax,
                start = allScales.findIndex(
                    scale => scale >= scaleMin
                );

            if (start == -1)
                return;
            
            allScales.slice(start).every(
                scale => {
                    if (scale > scaleMax)
                        return false;
                    implPoints.push(makePoint(freq, scale));
                    return true;
                }
            );
        }
    );
}

const tooltipCallback = (function() {
    const
        locale = undefined,
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

    return items => items.flatMap(
        item => {
            const raw = item.raw;
            if (item.dataset.label == 'Feasible region')
                return [
                    'Scale limit: ' + scaleFmt.format(raw.scale),
                    'Timer limit: ' + timerFmt.format(raw.valueIdeal),
                    'Freq limit: ' + freqFmt.format(raw.freq),
                ];
            
            const timeActual = raw.valueActual * raw.scale / raw.freq,
                error = timeActual/time - 1;

            return [
                'f = ' + freqFmt.format(raw.freq) + ' Hz',
                'scale = ' + scaleFmt.format(raw.scale),
                'tmr_idl = ' + timerFmt.format(-raw.valueIdeal),
                'tmr_act = ' + timerFmt.format(-raw.valueActual),
                't_idl = ' + timeFmt.format(time) + ' s',
                't_act = ' + timeFmt.format(timeActual) + ' s',
                'rel_err = ' + errorFmt.format(error),
            ];
        }
    );
})();

function updateGraphs() {
    fillFeasiblePoints();
    fillImplPoints();

    scaleFreqGraph.update();
    scaleValueGraph.update();
    valueFreqGraph.update();
}

function attachHandlers() {
    const
        timeInput = document.getElementById('time'),
        bitsInput = document.getElementById('bits'),
        freqInput = document.getElementById('freq'),
        specifiedScalerInputs = [
            '1', '2'
        ].map(id => document.getElementById('scale' + id)),
        rangeScaleInputs = [
            '3', '4'
        ].map(
            id => ({
                exp: document.getElementById('scale' + id + '_exp'),
                min: document.getElementById('scale' + id + '_min'),
                max: document.getElementById('scale' + id + '_max')
            })
        );

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
        const specified = specifiedScalerInputs.map(
            input => input.value.split(',').map(s => parseInt(s))
        );
        const ranges = rangeScaleInputs.map(
            inputs => {
                const
                    min = parseInt(inputs.min.value),
                    max = parseInt(inputs.max.value);
                const series = [
                    ...Array(max - min).keys()
                ].map(x => x + min);
                if (inputs.exp.checked)
                    return series.map(x => 1 << x);
                return series;
            }
        );
        allScales = [
            ...new Set(
                specified[0].flatMap(s1 =>
                    specified[1].flatMap(s2 =>
                        ranges[0].flatMap(s3 =>
                            ranges[1].map(s4 =>
                                s1 * s2 * s3 * s4
                            )
                        )
                    )
                )
            )
        ];
        allScales.sort(sortPredicate);
    }

    timeInput.addEventListener(
        'change', () => {parseTime(); updateGraphs()});
    bitsInput.addEventListener(
        'change', () => {parseBits(); updateGraphs()});
    freqInput.addEventListener(
        'change', () => {parseFreq(); updateGraphs()});

    function handleScale(input) {
        input.addEventListener(
            'change', () => {parseScale(); updateGraphs()}
        );
    }
    specifiedScalerInputs.forEach(handleScale);
    rangeScaleInputs.forEach(
        rangeScale => Object.values(rangeScale).forEach(handleScale)
    );

    parseTime();
    parseBits();
    parseFreq();
    parseScale();
}

function makeGraphs() {
    const dataConfig = {
        datasets: [
            {
                label: 'Feasible region',
                type: 'line',
                borderColor: '#cbeac9',
                data: feasiblePoints,
                order: 2
            },
            {
                label: 'Implementable',
                type: 'scatter',
                borderColor: '#75a6d1',
                data: implPoints,
                order: 1
            }
        ]
    };

    const options = {
        responsive: false,
        plugins: {
            tooltip: {
                callbacks: {
                    title: tooltipCallback
                }
            }
        },
        animation: {
            duration: 0
        },
    };

    const scaleFreqConfig = {
        options: {
            ...options,
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
                        text: 'freq (Hz)'
                    },
                    type: 'logarithmic'
                }
            },
            parsing: {
                xAxisKey: 'scale',
                yAxisKey: 'freq',
            }
        },
        data: dataConfig
    };

    const scaleValueConfig = {
        options: {
            ...options,
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
                        text: 'timer value (negated)'
                    },
                    type: 'logarithmic'
                }
            },
            parsing: {
                xAxisKey: 'scale',
                yAxisKey: 'valueIdeal',
            }
        },
        data: dataConfig
    };

    const valueFreqConfig = {
        options: {
            ...options,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'timer value (negated)'
                    },
                    type: 'logarithmic'
                },
                y: {
                    title: {
                        display: true,
                        text: 'freq (Hz)'
                    },
                    type: 'logarithmic'
                }
            },
            parsing: {
                xAxisKey: 'valueIdeal',
                yAxisKey: 'freq',
            }
        },
        data: dataConfig
    };

    scaleFreqGraph = new Chart(
        document.getElementById('scaleFreqChart').getContext('2d'), 
        scaleFreqConfig);
    scaleValueGraph = new Chart(
        document.getElementById('scaleValueChart').getContext('2d'), 
        scaleValueConfig);
    valueFreqGraph = new Chart(
        document.getElementById('valueFreqChart').getContext('2d'), 
        valueFreqConfig);
}

window.onload = function () {
    makeGraphs();
    attachHandlers();
    updateGraphs();
};

})();
