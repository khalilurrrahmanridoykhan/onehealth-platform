/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    id: 'be421663-abaa-48a8-9b6b-8e3644ce2c1d',
    name: 'data-quality-auditor',
    title: 'Data Quality Auditor',
    description:
        'Lets any DHIS2 admin point coverage, freshness, plausibility, and RDQA-aligned quality checks at any dataset on this instance -- no bundled programme list, no code changes.',

    minDHIS2Version: '2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'dataQualityAuditor',

    direction: 'auto',
}

module.exports = config
