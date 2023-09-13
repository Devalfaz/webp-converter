export interface Sites {
    sites: Site[];
}

export interface Site {
    id: string;
    workspaceId: string;
    displayName: string;
    shortName: string;
    previewUrl: string;
    timeZone: string;
    createdOn: Date;
    lastUpdated: Date;
    lastPublished: Date;
    customDomains: any[];
    locales: null;
}

export interface Collections {
    collections: Collection[];
}

export interface Collection {
    id: string;
    displayName: string;
    singularName: string;
    slug: string;
    createdOn: Date;
    lastUpdated: Date;
}

export interface CollectionsDetails {
    id: string;
    displayName: string;
    singularName: string;
    slug: string;
    createdOn: Date;
    lastUpdated: Date;
    fields: Field[];
}

export interface Field {
    id: string;
    isEditable: boolean;
    isRequired: boolean;
    type: string;
    slug: string;
    displayName: string;
    helpText: null;
    validations: Validations | null;
}

export interface Validations {
    maxLength: number;
    pattern?: Pattern;
    messages?: Messages;
}

export interface Messages {
    pattern: string;
    maxLength: string;
}

export interface Pattern {
}
