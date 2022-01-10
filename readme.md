# Embedded Timer Explorer

This is a toy design analysis utility meant to support decisions around 
configuring a 
[timer](https://en.wikipedia.org/wiki/Programmable_interval_timer) 
on a microcontroller. The initial configuration is an example meant to 
partially represent the possible configuration space for timer 0 on a 
[PIC18F66K40](https://ww1.microchip.com/downloads/en/DeviceDoc/40001842D.pdf).

## Features

- Architecture- and device-agnostic
- Selection of a target timer expiry duration
- Selection of the timer's counter bit width
- Representation of multiple, fixed clock source frequencies
- Representation of multiple scalers (potentially pre-scalers or post-scalers) 
  showing how their factor product affects the configuration space
- Scaler series as predefined, linear-range or binary-exponential-range mode
- Display of the feasible configuration space region as a projection of the
  actual bounding polytope
- Mouse-over information including timer value and accuracy

## Math

In this system, the independent variables are:
- bit width
- clock frequency
- pre-scale and post-scale factor
- expiry time

The dependent variables are:
- timer value
- resolution
- error

The fundamental equation being modelled is

    value * scale = time * freq

under the following constraint:

    1 <= value < 2^bits

Relative error is calculated as:

    time_actual / time_ideal - 1

## Reload integers

The timer reload value is represented as a modified two's-complement integer; with a 16-bit integer as an example:

- Zero (`0x0000`) is identical
- The negative portion (`0x8000` through `0xFFFF` representing -32768 through -1) is identical
- The other half - `0x0001` through `0x7FFF` - rather than representing positive numbers - represents the negative
  numbers from -65535 through -32769

This is to facilitate low-fuss, direct entry of an integer that will transparently convert to the correct machine code
representation while still being easily understood as a timer value with no positive-negative discontinuity. This
transparent conversion has worked in all of the compilers I've tried, most recently
[XC8](https://www.microchip.com/en-us/tools-resources/develop/mplab-xc-compilers); 
but of course you'll want to test this for yourself.
