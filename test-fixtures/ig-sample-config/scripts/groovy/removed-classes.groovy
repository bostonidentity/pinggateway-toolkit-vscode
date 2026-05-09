// Triggers G4-001, G4-002, G4-003, G4-004 (4 ERRORs).
package com.example.test

import groovy.util.XmlSlurper
import groovy.util.XmlParser
import groovy.util.GroovyTestCase
import groovy.util.AntBuilder

class LegacyScript extends GroovyTestCase {
    def doParse() {
        def slurper = new XmlSlurper()
        def parser = new XmlParser()
        def ant = new AntBuilder()
    }
}
