// Triggers SEC-103, PATH-101, PATH-102, PATH-103.
package com.example.test

class SecurityAndPaths {
    def password = "hardcoded-secret-value-123"
    def tomcatHome = "/tomcat9/webapps/ROOT/config.xml"
    def absolutePath = "/opt/myapp/data/file.txt"
    def relativePath = "../../external/config.xml"

    def init() {
        def envBase = System.getProperty('catalina.base')
        return [password, tomcatHome, absolutePath, relativePath, envBase]
    }
}
