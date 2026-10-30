import { clients, professionals, productFixtures } from "./demo.ts";

/** Synthetic administrative fields only. No contact can be used for delivery. */
export type DirectoryPerson = {
  id: string;
  name: string;
  phone: string;
  email: string;
  login: string;
  nickname: string;
  active: boolean;
  specialty: string;
};

export const demoClients: DirectoryPerson[] = clients.map((name, index) => ({
  id: `client-${index}`,
  name,
  phone: "Não informado",
  email: `cliente${index + 1}@example.test`,
  login: `cliente.demo.${index + 1}`,
  nickname: "Não informado",
  active: index !== clients.length - 1,
  specialty: "Não se aplica",
}));

export const demoProfessionals: DirectoryPerson[] = professionals.map(
  (name, index) => ({
    id: `professional-${index}`,
    name,
    phone: "Não informado",
    email: `profissional${index + 1}@example.test`,
    login: `profissional.demo.${index + 1}`,
    nickname: name.split(" ")[0],
    active: true,
    specialty: "Corte & barba",
  }),
);

export const demoStock = productFixtures.map((product, index) => ({
  ...product,
  id: `product-${index}`,
  brand: "Fonseca Demo",
  consumption: "Não definido",
  supplier: "Não vinculado na demonstração",
}));
