// Triggers G4-105 (line 4), G4-101 (line 9), G4-103 (line 13) — 3 WARNs.
package com.example.test

import groovy.util.*

class BehaviorChanges {
    def findCommon(listA, listB) {
        // intersect() semantics changed in Groovy 4
        return listA.intersect(listB)
    }

    def runQuery(query) {
        Sql.dataSource.call(query)
    }
}
