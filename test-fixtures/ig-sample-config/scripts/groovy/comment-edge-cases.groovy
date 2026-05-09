/* Multi-line block comment.
   Should NOT trigger anything despite mentioning .intersect( inside.
   Even if it spans multiple lines — strip_comments handles this. */
package com.example.test

class CommentEdges {
    def url = "http://example.com/path"  // mid-line // comments — should not affect detection
    def safe = "string with /* fake block */ inside"

    /* Another block
       with code-like content: import groovy.util.XmlSlurper
       still ignored. */

    def real() {
        // Below this comment IS the only real issue (G4-101)
        def list = [1, 2, 3].intersect([2, 3])
        return list
    }
}
