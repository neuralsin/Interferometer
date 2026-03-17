/**
 * Polarization Module — Jones Calculus
 *
 * Represents polarization states as 2×1 complex Jones vectors
 * and optical elements as 2×2 Jones matrices.
 *
 * Jones vector: [Ex, Ey] where each is { re, im }
 * Jones matrix: [[a, b], [c, d]] where each is { re, im }
 */

// ---- Complex arithmetic helpers ----
const cmul = (a, b) => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });

const cexp = (theta) => ({ re: Math.cos(theta), im: Math.sin(theta) });

const cscale = (s, a) => ({ re: s * a.re, im: s * a.im });

const czero = () => ({ re: 0, im: 0 });

const cone = () => ({ re: 1, im: 0 });

// ---- Matrix-vector multiplication ----
const matVecMul = (mat, vec) => [
  cadd(cmul(mat[0][0], vec[0]), cmul(mat[0][1], vec[1])),
  cadd(cmul(mat[1][0], vec[0]), cmul(mat[1][1], vec[1])),
];

// ---- Matrix-matrix multiplication ----
const matMul = (A, B) => [
  [
    cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])),
    cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1])),
  ],
  [
    cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])),
    cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1])),
  ],
];

// ---- Standard Jones Vectors ----
/** Horizontal linear polarization */
export const horizontalPol = () => [cone(), czero()];

/** Vertical linear polarization */
export const verticalPol = () => [czero(), cone()];

/** +45° linear polarization */
export const diag45Pol = () => {
  const s = 1 / Math.SQRT2;
  return [{ re: s, im: 0 }, { re: s, im: 0 }];
};

/** Right circular polarization */
export const rightCircularPol = () => {
  const s = 1 / Math.SQRT2;
  return [{ re: s, im: 0 }, { re: 0, im: -s }];
};

// ---- Standard Jones Matrices ----
/** Linear polarizer at angle θ (radians) */
export const linearPolarizer = (theta) => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [{ re: c * c, im: 0 }, { re: c * s, im: 0 }],
    [{ re: s * c, im: 0 }, { re: s * s, im: 0 }],
  ];
};

/** Half-wave plate with fast axis at angle θ */
export const halfWavePlate = (theta) => {
  const c2 = Math.cos(2 * theta);
  const s2 = Math.sin(2 * theta);
  return [
    [{ re: c2, im: 0 }, { re: s2, im: 0 }],
    [{ re: s2, im: 0 }, { re: -c2, im: 0 }],
  ];
};

/** Quarter-wave plate with fast axis at angle θ */
export const quarterWavePlate = (theta) => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const inv = 1 / Math.SQRT2;
  return [
    [
      { re: inv * (1 + c * c - s * s), im: inv * (c * c + s * s - 1) },
      // Simplified: using rotation-based form
      cadd(cscale(c * c, { re: inv, im: inv }), cscale(s * s, { re: inv, im: -inv })),
    ],
    [
      { re: inv * 2 * c * s, im: 0 },
      cadd(cscale(s * s, { re: inv, im: inv }), cscale(c * c, { re: inv, im: -inv })),
    ],
  ];
};

/**
 * Beam splitter Jones matrix.
 * For a 50:50 non-polarizing BS:
 *   Reflected: r * I, Transmitted: t * I
 *   where r = 1/√2, t = i/√2 (π/2 phase shift on reflection)
 *
 * @param {number} reflectance - Power reflectance [0,1], default 0.5
 * @returns {{ reflected: Array, transmitted: Array }} Jones matrices
 */
export const beamSplitterMatrices = (reflectance = 0.5) => {
  const r = Math.sqrt(reflectance);
  const t = Math.sqrt(1 - reflectance);
  return {
    reflected: [
      [{ re: 0, im: r }, czero()],
      [czero(), { re: 0, im: r }],
    ],
    transmitted: [
      [{ re: t, im: 0 }, czero()],
      [czero(), { re: t, im: 0 }],
    ],
  };
};

/**
 * Mirror Jones matrix. Perfect mirror flips handedness.
 * @returns {Array} 2×2 Jones matrix
 */
export const mirrorMatrix = () => [
  [{ re: 1, im: 0 }, czero()],
  [czero(), { re: -1, im: 0 }],
];

/**
 * Phase retarder (general): adds phase δ between x and y.
 * @param {number} delta - Phase retardation (radians)
 */
export const phaseRetarder = (delta) => [
  [cone(), czero()],
  [czero(), cexp(delta)],
];

/**
 * Apply a chain of Jones matrices to an input polarization state.
 * Elements are applied right-to-left (first in array = last applied).
 *
 * @param {Array} inputPol - Jones vector [Ex, Ey]
 * @param {Array[]} matrices - Array of Jones matrices
 * @returns {Array} Output Jones vector
 */
export const propagate = (inputPol, matrices) => {
  let state = inputPol;
  for (let i = matrices.length - 1; i >= 0; i--) {
    state = matVecMul(matrices[i], state);
  }
  return state;
};

/**
 * Compute intensity from a Jones vector: |Ex|² + |Ey|²
 */
export const jonesIntensity = (pol) =>
  pol[0].re ** 2 + pol[0].im ** 2 + pol[1].re ** 2 + pol[1].im ** 2;

export { matVecMul, matMul, cmul, cadd, cexp, cscale };
