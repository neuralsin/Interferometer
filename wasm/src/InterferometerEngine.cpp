/**
 * InterferometerEngine.cpp
 *
 * Main C++ physics engine for the Michelson Interferometer Simulab.
 * Compiled to WebAssembly via Emscripten with embind.
 *
 * Build: emcmake cmake .. && emmake make
 */

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <cmath>
#include <complex>
#include <vector>
#include <algorithm>

#include "GaussianBeam.h"
#include "CoherenceModel.h"
#include "NoiseGenerator.h"

using namespace emscripten;
using namespace physics;

constexpr double H_PLANCK = 6.62607015e-34;

static NoiseGenerator noiseGen(42);
static std::mt19937 continuousRng(123);
static std::normal_distribution<double> continuousDist(0.0, 1.0);

// Continuous stateful noise accumulators (no array regeneration)
static double currentPhaseNoise = 0.0;
static double currentSeismicX   = 0.0;
static double currentSeismicY   = 0.0;
static int noiseFrameCounter    = 0;

/**
 * Calculate the full fringe pattern with all physics models.
 *
 * Returns a flat Float64Array of N*N intensity values.
 */
val calculateFringePattern(
    double wavelength, double opd,
    double tiltX, double tiltY,
    int resolution,
    double linewidth, double beamWaist,
    bool phaseNoiseEnabled, bool seismicNoiseEnabled,
    bool shotNoiseEnabled, double squeezingParam,
    double gwStrain, double gwFrequency,
    double armLengthMultiplier
) {
    const int N = resolution;
    const double k = 2.0 * M_PI / wavelength;
    const double detectorSize = 0.01;
    const double halfSize = detectorSize / 2.0;

    // Coherence visibility
    double visibility = fringeVisibility(opd, linewidth);

    // Gaussian beam radii at detector
    GaussianBeamParams beam{beamWaist, wavelength};
    double zR = beam.rayleighRange();
    double wzX = beamRadius(beamWaist, std::abs(opd), zR);
    double wzY = beamRadius(beamWaist, std::abs(opd) * 0.5, zR);

    // ── Continuous stateful noise: one Wiener step per frame ──
    const double dt = 1.0 / 60.0;
    if (phaseNoiseEnabled) {
        double D = M_PI * linewidth;
        double sigma = std::sqrt(2.0 * D * dt);
        currentPhaseNoise += continuousDist(continuousRng) * sigma;
    }
    if (seismicNoiseEnabled) {
        double t = noiseFrameCounter * dt;
        currentSeismicX = 0;
        currentSeismicY = 0;
        double seisAmp = 1e-9;
        double freqs[] = {15.0, 30.0, 60.0, 120.0};
        for (auto freq : freqs) {
            currentSeismicX += (seisAmp / std::sqrt(freq)) * std::sin(2.0 * M_PI * freq * t + freq * 0.7321);
            currentSeismicY += (seisAmp / std::sqrt(freq)) * std::cos(2.0 * M_PI * freq * t + freq * 0.3179);
        }
        currentSeismicX += continuousDist(continuousRng) * seisAmp * 0.1;
        currentSeismicY += continuousDist(continuousRng) * seisAmp * 0.1;
    }
    noiseFrameCounter++;

    double phaseDelta = phaseNoiseEnabled ? currentPhaseNoise : 0.0;

    // Compute intensity grid
    std::vector<double> data(N * N);

    for (int j = 0; j < N; ++j) {
        double y = -halfSize + (static_cast<double>(j) / (N - 1)) * detectorSize;
        for (int i = 0; i < N; ++i) {
            double x = -halfSize + (static_cast<double>(i) / (N - 1)) * detectorSize;

            double r = std::sqrt(x * x + y * y);

            // Gaussian envelopes
            double ampX = std::exp(-(r * r) / (wzX * wzX));
            double ampY = std::exp(-(r * r) / (wzY * wzY));
            double I1 = ampX * ampX;
            double I2 = ampY * ampY;

            // Local OPD from tilt
            double opdLocal = opd + 2.0 * (tiltX * x + tiltY * y);

            // Phase
            double phase = k * opdLocal + phaseDelta;

            // Interference with coherence
            double intensity = I1 + I2
                + 2.0 * std::sqrt(I1 * I2) * visibility * std::cos(phase);
            intensity /= 4.0;

            data[j * N + i] = std::clamp(intensity, 0.0, 1.0);
        }
    }

    // Return as typed array
    val result = val::global("Float64Array").new_(N * N);
    val memoryView = val::module_property("HEAPF64");

    // Copy data to JS
    for (int i = 0; i < N * N; ++i) {
        result.set(i, data[i]);
    }

    return result;
}

EMSCRIPTEN_BINDINGS(interferometer) {
    function("calculateFringePattern", &calculateFringePattern);
}
