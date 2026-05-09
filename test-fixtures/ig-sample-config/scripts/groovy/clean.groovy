// Clean file — should produce zero issues.
package com.example.test

import groovy.xml.XmlSlurper
import groovy.xml.XmlParser

class CleanScript {
    def parse(String xmlText) {
        def slurper = new XmlSlurper()
        def root = slurper.parseText(xmlText)
        return root
    }
}
