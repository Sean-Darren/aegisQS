import { resources } from "@/lib/api";
export const variationsApi = {
  variations: resources.variations,
  raiseVariation: resources.raiseVariation,
  variation: resources.variation,
  updateCostLines: resources.updateCostLines,
  decideVariation: resources.decideVariation,
};
