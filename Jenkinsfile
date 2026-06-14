pipeline {
    agent  {
        label 'node-d-worker'
    }

    stages {
         stage('Test Docker') {
            steps {
                sh 'docker ps'
            }
        }
    }
}
