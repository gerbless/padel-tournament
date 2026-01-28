export interface Club {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateClubDto {
    name: string;
    description?: string;
    logo?: string;
}

export interface UpdateClubDto {
    name?: string;
    description?: string;
    logo?: string;
}
