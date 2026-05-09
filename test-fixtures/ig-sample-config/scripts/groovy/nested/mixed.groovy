// Nested file — confirms recursive directory walk.
// Triggers G4-001 (line 4) and IG-001 (line 9) — 2 ERRORs.
package com.example.test

import groovy.util.XmlSlurper

class NestedScript {
    def fetch(promise) {
        def result = promise.get()
        return result
    }
}
