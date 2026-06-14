pipeline {
    agent { label 'node-b-worker' }

    environment {
        IMAGE_NAME = "cookbook-app"
        IMAGE_TAG = "latest"
        REPO_URL = "https://github.com/dev-lcastaa/aqlabs-pipeline-scripts.git"
    }

    stages {

        stage('Cloning Pipeline Helper Scripts') {
            steps {
                echo '📋 Cloning pipeline helper scripts...'
                sh '''
                git clone $REPO_URL scripts
                '''
            }
        }

        stage('Building App') {
            steps {
                echo '🏗️ Running build script...'
                sh '''
                cd scripts
                chmod +x scripts/build.sh || true
                ./scripts/build.sh
                '''
            }
        }

        stage('Running Tests') {
            steps {
                echo '👟 Running tests...'
                sh '''
                chmod +x scripts/test.sh || true
                ./scripts/test.sh
                '''
            }
        }

        stage('Building Docker Image  ') {
            steps {
                echo '🏗️🐋🖼️ Building Docker image...'
                sh '''
                ls
                '''
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                echo '🚀🐋 Deploying with docker compose...'
                sh '''
                ls
                '''
            }
        }
    }

    post {
        success {
            echo '🎉✅ Pipeline completed successfully'
        }

        failure {
            echo '💥❌ Pipeline failed'
        }
    }
}