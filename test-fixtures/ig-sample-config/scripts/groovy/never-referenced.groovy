// Orphan script — no route references this file.
// Triggers G4-001 (line 4); also a future v0.2 "orphan script" warning.
package com.example.test

import groovy.util.XmlSlurper

class OrphanScript {
    def parse(String xmlText) {
        return new XmlSlurper().parseText(xmlText)
    }
}
