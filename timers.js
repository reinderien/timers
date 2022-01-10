(function() {

"use strict";

// initialised on parse
var time, valueMax, availFreq, allScales, 
    scaleFreqGraph, scaleValueGraph, valueFreqGraph;

// these references stay in-place and associated to the graph config;
// their contents are discarded and replaced on update
const
    scaleFreqFeasiblePoints = [],
    scaleFreqImplPoints = [],
    scaleValueImplPoints = [],
    valueFreqImplPoints = [];

function sortPredicate(a, b) { return a - b; }

function fillScaleFreqFeasiblePoints() {
    scaleFreqFeasiblePoints.length = 0;

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
                    scaleFreqFeasiblePoints.push(
                        // First obtuse corner
                        {y: sign * scaleCloseLimit/time * shrinkFactor, x: sign * scaleCloseLimit}
                    );
                }
            }

            scaleFreqFeasiblePoints.push(
                // Square corner
                {y: sign * freqCloseLimit, x: sign * scaleCorner},
                // Second obtuse corner
                {y: sign * freqCloseLimit, x: sign * Math.min(scaleFarLimit, freqCloseLimit*time / growFactor)},
            );
        }
        else {
            scaleFreqFeasiblePoints.push(
                // Corner (acute)
                {y: sign * freqAcute, x: sign * scaleCloseLimit}
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
        scaleFreqFeasiblePoints.length = 0;
        return;
    }

    // close loop
    scaleFreqFeasiblePoints.push(scaleFreqFeasiblePoints[0]);
}

function fillScaleFreqImplPoints() {
    scaleFreqImplPoints.length = 0;

    scaleFreqImplPoints.push(
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
                        scale => scale >= scaleMin
                    );

                if (start != -1) {
                    allScales.slice(start).every(
                        scale => {
                            if (scale > scaleMax)
                                return false;
                            row.push({x: scale, y: freq});
                            return true;
                        }
                    );
                }
                return row;
            }
        )
    );
}

function fillScaleValueImplPoints() {
    scaleValueImplPoints.length = 0;
    scaleValueImplPoints.push(
        ...allScales.flatMap(
            // There aren't many frequencies (compared to scales and values), so just filter this
            scale => availFreq
                .map(freq => ({x: scale, y: Math.round(time * freq / scale)}))
                .filter(point => point.y >= 1 && point.y <= valueMax)
        )
    )
}

function fillValueFreqImplPoints() {
    valueFreqImplPoints.length = 0;
    valueFreqImplPoints.push(
        ...availFreq.flatMap(
            freq => allScales
                .map(scale => ({x: time*freq/scale, y: freq}))
                .filter(point => point.x >= 1 && point.x <= valueMax)
        )
    )
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

    return items => items.flatMap(
        item => {
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
        }
    );
}

function updateGraphs() {
    fillScaleFreqFeasiblePoints();
    fillScaleFreqImplPoints();
    scaleFreqGraph.update();

    fillScaleValueImplPoints();
    scaleValueGraph.update();

    fillValueFreqImplPoints();
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

const scaleFreqConfig = {
    options: {
        responsive: true,
        plugins: {
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
                    text: 'freq (Hz)'
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
                data: scaleFreqFeasiblePoints,
                order: 2
            },
            {
                label: 'Implementable',
                type: 'scatter',
                borderColor: '#75a6d1',
                data: scaleFreqImplPoints,
                order: 1
            }
        ]
    }
};

const scaleValueConfig = {
    options: {
        responsive: true,
        plugins: {
            tooltip: {
                callbacks: {
                    // title: makeTooltipCallback()
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
                    text: 'timer value (negated)'
                },
                type: 'logarithmic'
            }
        },
    },
    data: {
        datasets: [
            /*{
                label: 'Feasible frequency region',
                type: 'line',
                borderColor: '#cbeac9',
                data: scaleFreqFeasiblePoints,
                order: 2
            },*/
            {
                label: 'Implementable',
                type: 'scatter',
                borderColor: '#75a6d1',
                data: scaleValueImplPoints,
                order: 1
            }
        ]
    }
};

const valueFreqConfig = {
    options: {
        responsive: true,
        plugins: {
            tooltip: {
                callbacks: {
                    // title: makeTooltipCallback()
                }
            }
        },
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
    },
    data: {
        datasets: [
            /*{
                label: 'Feasible frequency region',
                type: 'line',
                borderColor: '#cbeac9',
                data: scaleFreqFeasiblePoints,
                order: 2
            },*/
            {
                label: 'Implementable',
                type: 'scatter',
                borderColor: '#75a6d1',
                data: valueFreqImplPoints,
                order: 1
            }
        ]
    }
};

window.onload = function () {
    scaleFreqGraph = new Chart(
        document.getElementById('scaleFreqChart').getContext('2d'), 
        scaleFreqConfig);
    scaleValueGraph = new Chart(
        document.getElementById('scaleValueChart').getContext('2d'), 
        scaleValueConfig);
    valueFreqGraph = new Chart(
        document.getElementById('valueFreqChart').getContext('2d'), 
        valueFreqConfig);
    attachHandlers();
    updateGraphs();
};

})();
