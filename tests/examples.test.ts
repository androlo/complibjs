import { describe, it, expect } from "vitest";
import { measurePlank } from "../examples/e1_measuring_a_plank";
import { datasetCompletion } from "../examples/e2_dataset_completion";
import { simpleUnitFunction } from "../examples/e3_simple_unit_functions";
import { orthogonalSubstructure } from "../examples/e4_orthogonal_substructure";
import { datasetCompletionAdvanced } from "../examples/e5_dataset_completion_advanced";
import { valueRelations } from "../examples/e6_value_relations";
import { approximateEqualities } from "../examples/e7_approximate_equalities";
import { substitutability } from "../examples/e8_substitutability";
import { substitutabilityNonOrthogonal } from "../examples/e9_substitutability_non_ortho";
import { unitFunctionals } from "../examples/e10_unit_functionals";
import { unitFunctionMaterialization } from "../examples/e11_unit_function_materialization";
import { pendulumDataset } from "../examples/real_datasets/gravity_pendulum";



describe('examples', () => {
    
    describe('numbered examples', () => {
    
        it('e1', () => {
            expect(() => measurePlank()).not.toThrow();
        });

        it('e2', () => {
            expect(() => datasetCompletion()).not.toThrow();
        });

        it('e3', () => {
            expect(() => simpleUnitFunction()).not.toThrow();
        });

        it('e4', () => {
            expect(() => orthogonalSubstructure()).not.toThrow();
        });

        it('e5', () => {
            expect(() => datasetCompletionAdvanced()).not.toThrow();
        });

        it('e6', () => {
            expect(() => valueRelations()).not.toThrow();
        });

        it('e7', () => {
            expect(() => approximateEqualities()).not.toThrow();
        });

        it('e8', () => {
            expect(() => substitutability()).not.toThrow();
        });

        it('e9', () => {
            expect(() => substitutabilityNonOrthogonal()).not.toThrow();
        });

        it('e10', () => {
            expect(() => unitFunctionals()).not.toThrow();
        });

        it('e11', () => {
            expect(() => unitFunctionMaterialization()).not.toThrow();
        });

    });

    describe('real datasets', () => {

        it('pendulum dataset', () => {
            expect(() => pendulumDataset()).not.toThrow();
        });

    });

});

