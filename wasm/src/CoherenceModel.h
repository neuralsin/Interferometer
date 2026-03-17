#pragma once
#include <cmath>

namespace physics {

constexpr double C_LIGHT = 299792458.0;

/// Coherence length from frequency bandwidth
inline double coherenceLength(double deltaNU) {
    return C_LIGHT / deltaNU;
}

/// Lorentzian mutual coherence function |γ(τ)|
inline double coherenceLorentzian(double tau, double deltaNU) {
    return std::exp(-M_PI * deltaNU * std::abs(tau));
}

/// Fringe visibility from OPD and linewidth
inline double fringeVisibility(double opd, double deltaNU) {
    double tau = std::abs(opd) / C_LIGHT;
    return coherenceLorentzian(tau, deltaNU);
}

} // namespace physics
