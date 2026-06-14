pipeline {
    agent { label 'node-c-worker' }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        COMPOSE_PROJECT_NAME = 'cookbook-app'
        DOCKER_BUILDKIT = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
    }

    stages {
        stage('Checkout Source') {
            steps {
                echo '📥 Checking out source...'
                checkout scm
            }
        }

        stage('Validate Tooling') {
            steps {
                echo '🧰 Validating Docker and Compose availability...'
                sh '''
                docker --version
                docker compose version
                '''
            }
        }

        stage('Frontend Quality Gate') {
            steps {
                echo '🧪 Running frontend lint and build...'
                dir('frontend') {
                    sh '''
                    npm ci
                    npm run lint
                    npm run build
                    '''
                }
            }
        }

        stage('Build Container Images') {
            steps {
                echo '🏗️🐳 Building backend and frontend images locally on this node...'
                sh '''
                docker compose build
                '''
            }
        }

        stage('Deploy Stack') {
            steps {
                echo '🚀 Deploying with docker compose...'
                sh '''
                docker compose up -d --remove-orphans
                docker compose ps
                '''
            }
        }

        stage('Smoke Tests') {
            steps {
                echo '🩺 Running smoke tests against deployed services...'
                sh '''
                set +e
                for i in $(seq 1 20); do
                  curl -fsS http://localhost:8000/health >/dev/null && break
                  sleep 3
                done
                curl -fsS http://localhost:8000/health
                curl -fsS http://localhost:3000 >/dev/null
                set -e
                '''
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully.'
        }

        failure {
            echo '❌ Pipeline failed. Collecting compose diagnostics...'
            sh '''
            docker compose ps || true
            docker compose logs --no-color --tail=200 || true
            '''
        }

        always {
            echo '📊 Post-build compose status:'
            sh '''
            docker compose ps || true
            '''
        }
    }
}