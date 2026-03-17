#pragma once
#include <cmath>
#include <random>
#include <vector>

namespace physics {

class NoiseGenerator {
public:
    NoiseGenerator(unsigned seed = 42) : rng_(seed), dist_(0.0, 1.0) {}

    /// Wiener process phase noise
    std::vector<double> wienerPhaseNoise(int numSamples, double dt, double linewidth) {
        double D = M_PI * linewidth;
        double sigma = std::sqrt(2.0 * D * dt);
        std::vector<double> noise(numSamples, 0.0);
        for (int i = 1; i < numSamples; ++i) {
            noise[i] = noise[i - 1] + gaussian() * sigma;
        }
        return noise;
    }

    /// 1/f pink noise (Voss-McCartney)
    std::vector<double> pinkNoise(int numSamples, double amplitude, int numOctaves = 8) {
        std::vector<double> noise(numSamples);
        std::vector<double> octaves(numOctaves);
        for (auto& v : octaves) v = gaussian();

        for (int i = 0; i < numSamples; ++i) {
            for (int j = 0; j < numOctaves; ++j) {
                if (i % (1 << j) == 0) octaves[j] = gaussian();
            }
            double sum = 0;
            for (auto v : octaves) sum += v;
            noise[i] = (sum / numOctaves) * amplitude;
        }
        return noise;
    }

    /// Seismic vibration noise with resonance peaks
    std::vector<double> seismicNoise(
        int numSamples, double dt, double amplitude,
        const std::vector<double>& resonanceFreqs = {15, 30, 60, 120}
    ) {
        std::vector<double> noise(numSamples);
        for (int i = 0; i < numSamples; ++i) {
            double t = i * dt;
            double val = 0;
            for (auto freq : resonanceFreqs) {
                val += (amplitude / std::sqrt(freq))
                     * std::sin(2.0 * M_PI * freq * t + freq * 0.7321);
            }
            val += gaussian() * amplitude * 0.1;
            noise[i] = val;
        }
        return noise;
    }

private:
    std::mt19937 rng_;
    std::normal_distribution<double> dist_;

    double gaussian() { return dist_(rng_); }
};

} // namespace physics
