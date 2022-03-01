const AWS = require('aws-sdk')

module.exports = class SecretsManagerClient {
  constructor(options = {}) {
    this.secretsManagerClient = new AWS.SecretsManager(options)
    this.cache = null
  }

  /**
     * Efficiently get a secret from the environment variable,
     * else get secrets map from Secrets Manager and load into
     * environment variables for future calls
     */
  async getParam(name) {
    console.info('Getting param', { name })
    const envVarParam = process.env[name]
    if (envVarParam) {
      console.info('Found param in environment variables', { name })
      return envVarParam
    }

    const secretsManagerParams = await this.loadSecretsManagerParams()

    if (secretsManagerParams[name]) {
      console.info('Found param in Secrets Manager', { name })
      return secretsManagerParams[name]
    }
    console.info('Param not found', { name })
    return ''
  }

  /**
     * Obtains namespaced parameters from Secrets Manager and promises the result in a simple
     * key:value object.
     */
  async loadSecretsManagerParams() {
    try {
      if (this.cache) { return this.cache }

      let { SECRETS_MANAGER_PATH } = process.env
      if (!SECRETS_MANAGER_PATH) {
        console.info('SECRETS_MANAGER_PATH: not found')
        return this.cache = Promise.resolve({})
      } else {
        console.info('SECRETS_MANAGER_PATH', { SECRETS_MANAGER_PATH })
      }

      // Normalize the trailing slash
      if (SECRETS_MANAGER_PATH.slice(-1) !== '/') {
        SECRETS_MANAGER_PATH += '/'
        console.info('Normalized SECRETS_MANAGER_PATH', { SECRETS_MANAGER_PATH })
      }

      const data = await this.secretsManagerClient.getSecretValue({ SecretId: SECRETS_MANAGER_PATH }).promise()
      if ('SecretString' in data) {
        this.cache = JSON.parse(data.SecretString)
      } else {
        const buff =  Buffer.from(data.SecretBinary, 'base64')
        this.cache = JSON.parse(buff.toString('ascii'))
      }

      for (const key in this.cache) {
        if (key) {
          process.env[key] = this.cache[key]
        }
      }
      return this.cache
    } catch (e) {
      console.info('error', e)
    }
  }
}
