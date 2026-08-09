/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'data-quality-auditor',
    title: 'Data Quality Auditor',
    description:
        'Lets any DHIS2 admin point coverage, freshness, plausibility, and RDQA-aligned quality checks at any dataset on this instance -- no bundled programme list, no code changes.',

    coreCompatibility: '>=2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'dataQualityAuditor',

    direction: 'auto',
}

module.exports = config
