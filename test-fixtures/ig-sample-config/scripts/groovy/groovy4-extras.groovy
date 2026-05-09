// Triggers G4-102, G4-104, G4-106 (XmlSlurper used in code body).
package com.example.test

import groovy.xml.XmlSlurper
import groovy.transform.Field

@Field private String connection = 'shared'

class GroovyFourExtras {
    def combine(b, c) {
        def merged = b + c
        return merged
    }

    def buildClosure() {
        return { ->
            def slurper = new XmlSlurper()
            return slurper.parseText('<x/>')
        }
    }
}
