/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'onehealth-data-trust',
    title: 'OneHealth Data Trust',
    description:
        'Evidence, coverage, freshness, and quality reporting for eight public-health surveillance programmes, computed directly from this DHIS2 instance’s own data values.',

    coreCompatibility: '>=2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    direction: 'auto',
}

module.exports = config
