#pragma once
#include <cmath>
#include <complex>

namespace physics {

constexpr double TWO_PI = 2.0 * M_PI;

struct GaussianBeamParams {
    double w0;          // beam waist (m)
    double wavelength;  // λ (m)
    double E0 = 1.0;    // peak amplitude

    double rayleighRange() const { return M_PI * w0 * w0 / wavelength; }
    double wavenumber() const { return TWO_PI / wavelength; }
};

/// Beam radius w(z)
inline double beamRadius(double w0, double z, double zR) {
    return w0 * std::sqrt(1.0 + (z / zR) * (z / zR));
}

/// Radius of curvature R(z)
inline double radiusOfCurvature(double z, double zR) {
    if (std::abs(z) < 1e-15) return std::numeric_limits<double>::infinity();
    return z * (1.0 + (zR / z) * (zR / z));
}

/// Gouy phase ψ(z)
inline double gouyPhase(double z, double zR) {
    return std::atan2(z, zR);
}

/// Complex electric field E(r, z)
inline std::complex<double> gaussianField(
    double r, double z, const GaussianBeamParams& p
) {
    double k = p.wavenumber();
    double zR = p.rayleighRange();
    double wz = beamRadius(p.w0, z, zR);
    double Rz = radiusOfCurvature(z, zR);
    double psi = gouyPhase(z, zR);

    double amplitude = p.E0 * (p.w0 / wz) * std::exp(-(r * r) / (wz * wz));

    double phase = k * z - psi;
    if (std::isfinite(Rz)) {
        phase += k * r * r / (2.0 * Rz);
    }

    return amplitude * std::exp(std::complex<double>(0, -phase));
}

} // namespace physics
