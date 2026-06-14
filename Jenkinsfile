pipeline {
    agent  {
        label 'node-e-worker'
    }

    stages {
         stage('Test Docker') {
            steps {
                sh 'docker ps'
            }
        }
    }
}
