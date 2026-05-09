// Triggers G4-201 (line 6), G4-202 (line 7) — 2 INFOs.
package com.example.test

class FloatChecks {
    boolean isZeroLike(float someFloat, Object obj) {
        boolean zero = (someFloat == 0.0f)
        def props = obj.getProperties()
        return zero && !props.isEmpty()
    }
}
