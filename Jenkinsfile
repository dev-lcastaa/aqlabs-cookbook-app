pipeline {
    agent  {
        label 'node-c-worker'
    }

    stages {
         stage('Test Docker') {
            steps {
                sh 'docker ps'
            }
        }
    }
}
