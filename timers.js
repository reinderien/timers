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

var time = 1e-1,
    bits = 16,
    avail_freq = [31e3, 1e6, 2e6, 4e6, 8e6, 12e6, 16e6, 32e6, 48e6, 64e6],
    avail_prescale = [
        ...Array(16).keys()
    ].map(i => 2**i),
    avail_postscale = [
        ...Array(16).keys()
    ].map(i => i + 1);

const 
    value_max = 2**bits - 1,
    all_scales = [
        ...new Set(
            avail_prescale.flatMap(
                prescale => avail_postscale.map(
                    postscale => prescale * postscale
                )
            )
        )
    ];

function make_feasibility_points() {
    const 
        freq_bottom = Math.min(...avail_freq),
        freq_top    = Math.max(...avail_freq),
        scale_left  = Math.min(...all_scales),
        scale_right = Math.max(...all_scales);

    const
        freq_sw = scale_left/time,
        freq_se = scale_right/time,
        freq_nw = freq_sw * value_max,
        freq_ne = freq_se * value_max;
        
    const points = [];

    if (freq_sw < freq_bottom) {
        var scale_sw = freq_bottom*time / value_max;
        if (scale_sw < scale_left) {
            scale_sw = scale_left;
            if (freq_nw < freq_top) {
                points.push(
                    // west corner (obtuse)
                    {y: scale_left/time * value_max, x: scale_left}
                );
            }
        }

        points.push(
            // southwest corner (square)
            {y: freq_bottom, x: scale_sw},
            // southeast corner (obtuse)
            {y: freq_bottom, x: Math.min(scale_right, freq_bottom*time)},
        );
    }
    else {
        points.push(
            // southwest corner (acute)
            {y: freq_sw, x: scale_left}
        );
    }
    
    if (freq_ne > freq_top) {
        var scale_ne = freq_top*time;
        if (scale_ne > scale_right) {
            scale_ne = scale_right;
            if (freq_se > freq_bottom) {
                points.push(
                    // east corner (obtuse)
                    {y: scale_right/time, x: scale_right}
                );
            }
        }

        points.push(
            // northeast corner (square)
            {y: freq_top, x: scale_ne},
            // northwest corner (obtuse)
            {y: freq_top, x: Math.max(scale_left,  freq_top*time / value_max)},
        );
    }
    else {
        points.push(
            // northeast corner (acute)
            {y: freq_ne, x: scale_right}
        );
    }
    
    // close loop
    points.push(points[0]);

    return points;
}

function make_implementation_points() {
    return avail_freq.flatMap(freq => {
        // We could do a naive filter(), but that doesn't capture the fact that there will be:
        //   0 or more out-of-range,
        //   0 or more in-range, and then
        //   0 or more out-of-range, in that order.
        // The best approach to finding both bounds would be a bisection, but isn't built into JS.
        // Whatever.
        const row = [],
            scale_max = time*freq,
            scale_min = scale_max / value_max, 
            start = all_scales.findIndex(
                scale =>  scale >= scale_min
            );

        if (start != -1) {
            all_scales.slice(start).every(scale => {
                if (scale > scale_max)
                    return false;
                row.push({x: scale, y: freq});
                return true;
            });
        }
        return row;
    });
}

const 
    feasibility_points = make_feasibility_points(),
    implementation_points = make_implementation_points(),
    scale_labels = [
        ...new Set(
            feasibility_points
            .concat(implementation_points)
            .map(xy => xy.x)
        )
    ];

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

function tooltipCallback(items) {
    return items.flatMap(item => {
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
                text: 'Frequency versus Scale'
            },
            tooltip: {
                callbacks: {
                    title: tooltipCallback
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
                data: feasibility_points,
                order: 2
            },
            {
                label: 'Implementable',
                type: 'scatter',
                borderColor: '#75a6d1',
                data: implementation_points,
                order: 1
            }
        ],
        labels: scale_labels
    }
};

window.onload = function () {
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, config);
};

})();
