// noinspection GrazieInspection
import {
    ALGEBRA_IVAL,
    CFCompFuncBinary,
    CFCompData,
    CFIval,
    CFReal,
    CFUint32,
    createBinaryCompFunc,
    createBaseUnitFunction
} from "../../src";

/**
Here we will look at a scrappy pendulum dataset:
https://github.com/kreier/labs/blob/main/frequency-pendulum/2019-10-28%20measurements.xlsx

	Pendulum lab - period depending on pendulum length
 	                length	                                period (s)
    student	mass (g)	length (m)	error (m)	trial1	trial2	trial3	trial4	trial5	error	average	stdev
1	Aiden	500	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
2	An	    50	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
3	Tommy	500	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
4	Sean	50	        0.950	    0.001	    1.920	1.940	1.900   -       -       0.02	1.920	0.020
5	Tom	    50	        0.250	    0.005	 	-	 	-	 	-       -       -       0.02	-	    -
6	Tiffany	20	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
7	Thanh	50	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
8	Helen	50	        0.420	 	-	 	 	-       -       -       -       -       0.02	-	    -
9	Bill	200	        1.350	    0.010	    2.365   2.367   2.386   2.385	2.386	0.02	2.378	0.011
10	Toan	100	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
11	Michael	200	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
12	Sean	500	 	 	-	 	 	-	 	    -       -       -       -       -       0.02	-	    -
13	Saurabh	50	        0.540	    0.001	    1.580	1.600	1.560	-	 	-       0.02	1.580	0.020
14	mk1	    50	        2.854	    0.005	    3.409	3.405	3.396	3.395	3.401	0.02	3.401	0.006
15	mk2	    50	        2.374	    0.005	    3.076	3.055	3.070	3.088	3.080	0.02	3.074	0.012
16	mk3	    50	        0.175	    0.002	    0.872	0.863	0.853	0.852	0.863	0.02	0.861	0.008
17	mk4	    50	        0.102	    0.003	    0.646	0.630	0.637	0.656	0.647	0.02	0.643	0.010
18	mk5	    50	        0.055	    0.002	    0.496	0.486	0.489	0.482	0.480	0.02	0.487	0.006
19	mk6	    250	        5.009	    0.003	    4.520	4.510	4.510	4.560	4.520	0.02	4.524	0.021
20	Joe	    10	        0.007	    0.001	 	-	 	-	 	-       -       -       0.02	-	    -
Who is Joe? He is the one who made the result? like 결과를 만든 사람?      jawohl
    Joe     10	        0.007	    0.001	    0.504		obviously wrong
	           too bad: 5 values just from your teacher ...

The purpose of this example is to illustrate how we may model a somewhat complex (and incomplete)
dataset, to show that the comparison framework has no problems with this.

Another thing to note is that this is all about learning how to model, not to give opinions about what a
dataset ought to contain or what it should look like. It is what it is, and we will model the table faithfully,
accounting for all missing data and including the near-empty rows and superfluous columns (mass isn't really
a useful observable in this context). However, we will not include the 'average' and 'stdev' columns - not
because they are derived values, but because they do not specify a unit.
*/

export function pendulumDataset(): void {

    /**
     *
     * Step 1:
     *
     * We have several categories of observables (mass, length, period) - all except mass have stated errors.
     * There are also several versions of each observable (one for each student, except for Joe, who has two).
     * For all students S, we use the observable names: mass_S, len_S, period_S for their mass, length, and
     * periods respectively (e.g., "mass_Bill" is "the mass of Bill's pendulum weight). We will model this as
     * one big experiment, and we think of all observables as distinct, so we define units for everything.
     * It is possible that several students use the same actual pendulums, or at least weights (many weights
     * have the same value in grams), but we still assume that each student has a unique weight.
     *
     * We also have several trials, which we can model using series indices, e.g., trial1 is given index '0',
     * trial2 is given index '1', etc. (we want the series indices as 0, 1, 2, ...).
     */
    const mass_Aiden    = 0 as CFUint32;
    const mass_An       = 1 as CFUint32;
    const mass_Tommy    = 2 as CFUint32;
    const mass_Sean     = 3 as CFUint32,  length_Sean   = 4 as CFUint32,  period_Sean   = 5 as CFUint32;
    const mass_Tom      = 6 as CFUint32,  length_Tom    = 7 as CFUint32;
    const mass_Tiffany  = 8 as CFUint32;
    const mass_Thanh    = 9 as CFUint32;
    const mass_Helen    = 10 as CFUint32, length_Helen  = 11 as CFUint32;
    const mass_Bill     = 12 as CFUint32, length_Bill   = 13 as CFUint32, period_Bill   = 14 as CFUint32;
    const mass_Toan     = 15 as CFUint32;
    const mass_Michael  = 16 as CFUint32;
    const mass_Sean2    = 17 as CFUint32;
    const mass_Saurabh  = 18 as CFUint32, length_Saurabh= 19 as CFUint32, period_Saurabh= 20 as CFUint32;
    const mass_mk1      = 21 as CFUint32, length_mk1    = 22 as CFUint32, period_mk1    = 23 as CFUint32;
    const mass_mk2      = 24 as CFUint32, length_mk2    = 25 as CFUint32, period_mk2    = 26 as CFUint32;
    const mass_mk3      = 27 as CFUint32, length_mk3    = 28 as CFUint32, period_mk3    = 29 as CFUint32;
    const mass_mk4      = 30 as CFUint32, length_mk4    = 31 as CFUint32, period_mk4    = 32 as CFUint32;
    const mass_mk5      = 33 as CFUint32, length_mk5    = 34 as CFUint32, period_mk5    = 35 as CFUint32;
    const mass_mk6      = 36 as CFUint32, length_mk6    = 37 as CFUint32, period_mk6    = 38 as CFUint32;
    const mass_Joe      = 39 as CFUint32, length_Joe    = 40 as CFUint32;
    const mass_Joe2     = 41 as CFUint32, length_Joe2   = 42 as CFUint32, period_Joe2   = 43 as CFUint32;

    // Finally, the table states that measurements are done against the meter, gram, and second.
    const meter = 44 as CFUint32, gram = 45 as CFUint32, second = 46 as CFUint32;

    // Specify the number of units and series indices.
    const numUnits = 47 as CFUint32;
    const numSeriesIndices = 5 as CFUint32;

    /**
     * Step 2:
     *
     * Generate comparisons where there are actual values. A proper reader plus converter function
     * for the table would be the right way to produce comparison data from other data, but this is
     * just a simple example. Also, AI was used to quickly produce these arrays from the table.
     */

    // Aiden (mass only)
    const data_Aiden: CFCompData[] = [
        [mass_Aiden, gram, 0, [500, 500]],
        [mass_Aiden, gram, 1, [500, 500]],
        [mass_Aiden, gram, 2, [500, 500]],
        [mass_Aiden, gram, 3, [500, 500]],
        [mass_Aiden, gram, 4, [500, 500]],
    ];

    // An (mass only)
    const data_An: CFCompData[] = [
        [mass_An, gram, 0, [50, 50]],
        [mass_An, gram, 1, [50, 50]],
        [mass_An, gram, 2, [50, 50]],
        [mass_An, gram, 3, [50, 50]],
        [mass_An, gram, 4, [50, 50]],
    ];

    // Tommy (mass only)
    const data_Tommy: CFCompData[] = [
        [mass_Tommy, gram, 0, [500, 500]],
        [mass_Tommy, gram, 1, [500, 500]],
        [mass_Tommy, gram, 2, [500, 500]],
        [mass_Tommy, gram, 3, [500, 500]],
        [mass_Tommy, gram, 4, [500, 500]],
    ];

    // Sean (the measured one, length + 3 periods)
    const data_Sean: CFCompData[] = [
        // trial 0
        [mass_Sean, gram, 0, [50, 50]],
        [length_Sean, meter, 0, [0.9495, 0.9505]],
        [period_Sean, second, 0, [1.91, 1.93]],

        // trial 1
        [mass_Sean, gram, 1, [50, 50]],
        [length_Sean, meter, 1, [0.9495, 0.9505]],
        [period_Sean, second, 1, [1.93, 1.95]],

        // trial 2
        [mass_Sean, gram, 2, [50, 50]],
        [length_Sean, meter, 2, [0.9495, 0.9505]],
        [period_Sean, second, 2, [1.89, 1.91]],

        // trial 3 (mass + length only)
        [mass_Sean, gram, 3, [50, 50]],
        [length_Sean, meter, 3, [0.9495, 0.9505]],

        // trial 4 (mass + length only)
        [mass_Sean, gram, 4, [50, 50]],
        [length_Sean, meter, 4, [0.9495, 0.9505]],
    ];

    // Tom (length but no periods)
    const data_Tom: CFCompData[] = [
        [mass_Tom, gram, 0, [50, 50]],
        [length_Tom, meter, 0, [0.2475, 0.2525]],

        [mass_Tom, gram, 1, [50, 50]],
        [length_Tom, meter, 1, [0.2475, 0.2525]],

        [mass_Tom, gram, 2, [50, 50]],
        [length_Tom, meter, 2, [0.2475, 0.2525]],

        [mass_Tom, gram, 3, [50, 50]],
        [length_Tom, meter, 3, [0.2475, 0.2525]],

        [mass_Tom, gram, 4, [50, 50]],
        [length_Tom, meter, 4, [0.2475, 0.2525]],
    ];

    // Tiffany (mass only)
    const data_Tiffany: CFCompData[] = [
        [mass_Tiffany, gram, 0, [20, 20]],
        [mass_Tiffany, gram, 1, [20, 20]],
        [mass_Tiffany, gram, 2, [20, 20]],
        [mass_Tiffany, gram, 3, [20, 20]],
        [mass_Tiffany, gram, 4, [20, 20]],
    ];

    // Thanh (mass only)
    const data_Thanh: CFCompData[] = [
        [mass_Thanh, gram, 0, [50, 50]],
        [mass_Thanh, gram, 1, [50, 50]],
        [mass_Thanh, gram, 2, [50, 50]],
        [mass_Thanh, gram, 3, [50, 50]],
        [mass_Thanh, gram, 4, [50, 50]],
    ];

    // Helen (length present but no error given -> exact)
    const data_Helen: CFCompData[] = [
        [mass_Helen, gram, 0, [50, 50]],
        [length_Helen, meter, 0, [0.42, 0.42]],

        [mass_Helen, gram, 1, [50, 50]],
        [length_Helen, meter, 1, [0.42, 0.42]],

        [mass_Helen, gram, 2, [50, 50]],
        [length_Helen, meter, 2, [0.42, 0.42]],

        [mass_Helen, gram, 3, [50, 50]],
        [length_Helen, meter, 3, [0.42, 0.42]],

        [mass_Helen, gram, 4, [50, 50]],
        [length_Helen, meter, 4, [0.42, 0.42]],
    ];

    // Bill (full 5 trials)
    const data_Bill: CFCompData[] = [
        // trial 0
        [mass_Bill, gram, 0, [200, 200]],
        [length_Bill, meter, 0, [1.345, 1.355]],
        [period_Bill, second, 0, [2.355, 2.375]],

        // trial 1
        [mass_Bill, gram, 1, [200, 200]],
        [length_Bill, meter, 1, [1.345, 1.355]],
        [period_Bill, second, 1, [2.357, 2.377]],

        // trial 2
        [mass_Bill, gram, 2, [200, 200]],
        [length_Bill, meter, 2, [1.345, 1.355]],
        [period_Bill, second, 2, [2.376, 2.396]],

        // trial 3
        [mass_Bill, gram, 3, [200, 200]],
        [length_Bill, meter, 3, [1.345, 1.355]],
        [period_Bill, second, 3, [2.375, 2.395]],

        // trial 4
        [mass_Bill, gram, 4, [200, 200]],
        [length_Bill, meter, 4, [1.345, 1.355]],
        [period_Bill, second, 4, [2.376, 2.396]],
    ];

    // Toan (mass only)
    const data_Toan: CFCompData[] = [
        [mass_Toan, gram, 0, [100, 100]],
        [mass_Toan, gram, 1, [100, 100]],
        [mass_Toan, gram, 2, [100, 100]],
        [mass_Toan, gram, 3, [100, 100]],
        [mass_Toan, gram, 4, [100, 100]],
    ];

    // Michael (mass only)
    const data_Michael: CFCompData[] = [
        [mass_Michael, gram, 0, [200, 200]],
        [mass_Michael, gram, 1, [200, 200]],
        [mass_Michael, gram, 2, [200, 200]],
        [mass_Michael, gram, 3, [200, 200]],
        [mass_Michael, gram, 4, [200, 200]],
    ];

    // Sean2 (the second “Sean”, mass only but 500 g)
    const data_Sean2: CFCompData[] = [
        [mass_Sean2, gram, 0, [500, 500]],
        [mass_Sean2, gram, 1, [500, 500]],
        [mass_Sean2, gram, 2, [500, 500]],
        [mass_Sean2, gram, 3, [500, 500]],
        [mass_Sean2, gram, 4, [500, 500]],
    ];

    // Saurabh (length + 3 periods)
    const data_Saurabh: CFCompData[] = [
        // trial 0
        [mass_Saurabh, gram, 0, [50, 50]],
        [length_Saurabh, meter, 0, [0.5395, 0.5405]],
        [period_Saurabh, second, 0, [1.57, 1.59]],

        // trial 1
        [mass_Saurabh, gram, 1, [50, 50]],
        [length_Saurabh, meter, 1, [0.5395, 0.5405]],
        [period_Saurabh, second, 1, [1.59, 1.61]],

        // trial 2
        [mass_Saurabh, gram, 2, [50, 50]],
        [length_Saurabh, meter, 2, [0.5395, 0.5405]],
        [period_Saurabh, second, 2, [1.55, 1.57]],

        // trial 3 (no period)
        [mass_Saurabh, gram, 3, [50, 50]],
        [length_Saurabh, meter, 3, [0.5395, 0.5405]],

        // trial 4 (no period)
        [mass_Saurabh, gram, 4, [50, 50]],
        [length_Saurabh, meter, 4, [0.5395, 0.5405]],
    ];

    // mk1
    const data_mk1: CFCompData[] = [
        [mass_mk1, gram, 0, [50, 50]],
        [length_mk1, meter, 0, [2.8515, 2.8565]],
        [period_mk1, second, 0, [3.399, 3.419]],

        [mass_mk1, gram, 1, [50, 50]],
        [length_mk1, meter, 1, [2.8515, 2.8565]],
        [period_mk1, second, 1, [3.395, 3.415]],

        [mass_mk1, gram, 2, [50, 50]],
        [length_mk1, meter, 2, [2.8515, 2.8565]],
        [period_mk1, second, 2, [3.386, 3.406]],

        [mass_mk1, gram, 3, [50, 50]],
        [length_mk1, meter, 3, [2.8515, 2.8565]],
        [period_mk1, second, 3, [3.385, 3.405]],

        [mass_mk1, gram, 4, [50, 50]],
        [length_mk1, meter, 4, [2.8515, 2.8565]],
        [period_mk1, second, 4, [3.391, 3.411]],
    ];

    // mk2
    const data_mk2: CFCompData[] = [
        [mass_mk2, gram, 0, [50, 50]],
        [length_mk2, meter, 0, [2.3715, 2.3765]],
        [period_mk2, second, 0, [3.066, 3.086]],

        [mass_mk2, gram, 1, [50, 50]],
        [length_mk2, meter, 1, [2.3715, 2.3765]],
        [period_mk2, second, 1, [3.045, 3.065]],

        [mass_mk2, gram, 2, [50, 50]],
        [length_mk2, meter, 2, [2.3715, 2.3765]],
        [period_mk2, second, 2, [3.06, 3.08]],

        [mass_mk2, gram, 3, [50, 50]],
        [length_mk2, meter, 3, [2.3715, 2.3765]],
        [period_mk2, second, 3, [3.078, 3.098]],

        [mass_mk2, gram, 4, [50, 50]],
        [length_mk2, meter, 4, [2.3715, 2.3765]],
        [period_mk2, second, 4, [3.07, 3.09]],
    ];

    // mk3
    const data_mk3: CFCompData[] = [
        [mass_mk3, gram, 0, [50, 50]],
        [length_mk3, meter, 0, [0.174, 0.176]],
        [period_mk3, second, 0, [0.862, 0.882]],

        [mass_mk3, gram, 1, [50, 50]],
        [length_mk3, meter, 1, [0.174, 0.176]],
        [period_mk3, second, 1, [0.853, 0.873]],

        [mass_mk3, gram, 2, [50, 50]],
        [length_mk3, meter, 2, [0.174, 0.176]],
        [period_mk3, second, 2, [0.843, 0.863]],

        [mass_mk3, gram, 3, [50, 50]],
        [length_mk3, meter, 3, [0.174, 0.176]],
        [period_mk3, second, 3, [0.842, 0.862]],

        [mass_mk3, gram, 4, [50, 50]],
        [length_mk3, meter, 4, [0.174, 0.176]],
        [period_mk3, second, 4, [0.853, 0.873]],
    ];

    // mk4
    const data_mk4: CFCompData[] = [
        [mass_mk4, gram, 0, [50, 50]],
        [length_mk4, meter, 0, [0.1005, 0.1035]],
        [period_mk4, second, 0, [0.636, 0.656]],

        [mass_mk4, gram, 1, [50, 50]],
        [length_mk4, meter, 1, [0.1005, 0.1035]],
        [period_mk4, second, 1, [0.62, 0.64]],

        [mass_mk4, gram, 2, [50, 50]],
        [length_mk4, meter, 2, [0.1005, 0.1035]],
        [period_mk4, second, 2, [0.627, 0.647]],

        [mass_mk4, gram, 3, [50, 50]],
        [length_mk4, meter, 3, [0.1005, 0.1035]],
        [period_mk4, second, 3, [0.646, 0.666]],

        [mass_mk4, gram, 4, [50, 50]],
        [length_mk4, meter, 4, [0.1005, 0.1035]],
        [period_mk4, second, 4, [0.637, 0.657]],
    ];

    // mk5
    const data_mk5: CFCompData[] = [
        [mass_mk5, gram, 0, [50, 50]],
        [length_mk5, meter, 0, [0.054, 0.056]],
        [period_mk5, second, 0, [0.486, 0.506]],

        [mass_mk5, gram, 1, [50, 50]],
        [length_mk5, meter, 1, [0.054, 0.056]],
        [period_mk5, second, 1, [0.476, 0.496]],

        [mass_mk5, gram, 2, [50, 50]],
        [length_mk5, meter, 2, [0.054, 0.056]],
        [period_mk5, second, 2, [0.479, 0.499]],

        [mass_mk5, gram, 3, [50, 50]],
        [length_mk5, meter, 3, [0.054, 0.056]],
        [period_mk5, second, 3, [0.472, 0.492]],

        [mass_mk5, gram, 4, [50, 50]],
        [length_mk5, meter, 4, [0.054, 0.056]],
        [period_mk5, second, 4, [0.47, 0.49]],
    ];

    // mk6
    const data_mk6: CFCompData[] = [
        [mass_mk6, gram, 0, [250, 250]],
        [length_mk6, meter, 0, [5.0075, 5.0105]],
        [period_mk6, second, 0, [4.51, 4.53]],

        [mass_mk6, gram, 1, [250, 250]],
        [length_mk6, meter, 1, [5.0075, 5.0105]],
        [period_mk6, second, 1, [4.5, 4.52]],

        [mass_mk6, gram, 2, [250, 250]],
        [length_mk6, meter, 2, [5.0075, 5.0105]],
        [period_mk6, second, 2, [4.5, 4.52]],

        [mass_mk6, gram, 3, [250, 250]],
        [length_mk6, meter, 3, [5.0075, 5.0105]],
        [period_mk6, second, 3, [4.55, 4.57]],

        [mass_mk6, gram, 4, [250, 250]],
        [length_mk6, meter, 4, [5.0075, 5.0105]],
        [period_mk6, second, 4, [4.51, 4.53]],
    ];

    // Joe (mass + length, no periods from the table)
    const data_Joe: CFCompData[] = [
        [mass_Joe, gram, 0, [10, 10]],
        [length_Joe, meter, 0, [0.0065, 0.0075]],

        [mass_Joe, gram, 1, [10, 10]],
        [length_Joe, meter, 1, [0.0065, 0.0075]],

        [mass_Joe, gram, 2, [10, 10]],
        [length_Joe, meter, 2, [0.0065, 0.0075]],

        [mass_Joe, gram, 3, [10, 10]],
        [length_Joe, meter, 3, [0.0065, 0.0075]],

        [mass_Joe, gram, 4, [10, 10]],
        [length_Joe, meter, 4, [0.0065, 0.0075]],
    ];

    // "Bonus" Joe from the table
    const data_Joe2: CFCompData[] = [
        [mass_Joe2, gram, 0, [10, 10]],
        [length_Joe2, meter, 0, [0.0065, 0.0075]],
        // Note that there is no error provided for this data-point.
        [period_Joe2, second, 0, [0.504, 0.504]],

        [mass_Joe2, gram, 1, [10, 10]],
        [length_Joe2, meter, 1, [0.0065, 0.0075]],

        [mass_Joe2, gram, 2, [10, 10]],
        [length_Joe2, meter, 2, [0.0065, 0.0075]],

        [mass_Joe2, gram, 3, [10, 10]],
        [length_Joe2, meter, 3, [0.0065, 0.0075]],

        [mass_Joe2, gram, 4, [10, 10]],
        [length_Joe2, meter, 4, [0.0065, 0.0075]],
    ];

    // Now we mash the data together.
    const dataSet: CFCompData[] = [
        ...data_Aiden,
        ...data_An,
        ...data_Tommy,
        ...data_Sean,
        ...data_Tom,
        ...data_Tiffany,
        ...data_Thanh,
        ...data_Helen,
        ...data_Bill,
        ...data_Toan,
        ...data_Michael,
        ...data_Sean2,
        ...data_Saurabh,
        ...data_mk1,
        ...data_mk2,
        ...data_mk3,
        ...data_mk4,
        ...data_mk5,
        ...data_mk6,
        ...data_Joe,
        ...data_Joe2
    ];

    /**
     * Let's look at a dataset:
     *
     * const data_Sean: CFCompData[] = [
     *      // trial 0
     *      [mass_Sean, gram, 0, [50, 50]],
     *      [length_Sean, meter, 0, [0.9495, 0.9505]],
     *      [period_Sean, second, 0, [1.91, 1.93]],
     *
     *      // trial 1
     *      [mass_Sean, gram, 1, [50, 50]],
     *      [length_Sean, meter, 1, [0.9495, 0.9505]],
     *      [period_Sean, second, 1, [1.93, 1.95]],
     *
     *      // trial 2
     *      [mass_Sean, gram, 2, [50, 50]],
     *      [length_Sean, meter, 2, [0.9495, 0.9505]],
     *      [period_Sean, second, 2, [1.89, 1.91]],
     *
     *      // trial 3 (mass + length only)
     *      [mass_Sean, gram, 3, [50, 50]],
     *      [length_Sean, meter, 3, [0.9495, 0.9505]],
     *
     *      // trial 4 (mass + length only)
     *      [mass_Sean, gram, 4, [50, 50]],
     *      [length_Sean, meter, 4, [0.9495, 0.9505]],
     * ];
     *
     * As we can see, the data-point for mass and length are included for all trials. This is because
     * we assume that they are supposed to be the same during all trials. There is no trial index for
     * them, so this is a sensible assumption.
     *
     * Another thing we do is to include trial 'i' for all experimenters as a single experiment, i.e.,
     * trial0 for all is considered to be part of the same group of experiments.
     *
     * We can also see that trials 3 and 4 have no period measurements. That is simply because there are
     * no period measurements for those trials. For consistency, we still include the mass and length
     * measurements for those trials, since the aggregated dataset contains all trials for all
     * experimenters.
     *
     * The rules for computing the values here are simple:
     * 1. We use intervals.
     * 2. Mass has no stated error, so for each mass value m we use [m, m].
     * 3. Length has a stated error, which we include here as 'e': [len - e/2, len + e/2].
     * 4. Period has a stated error, but it is assumed to be the same for all trials, so we use
     *    that error for all period values.
     *
     * A thing to note is that for Helen, there is no error for length, so in that case we will use
     * error 0 - but this is the only exception for length. There is one more exception for
     * Joe's second row, which has no error provided for the period, and we'll do the same there.
     */

    // Use Interval Algebra.
    const algebra = ALGEBRA_IVAL;

    let compFunc: CFCompFuncBinary;

    // Now we create a comparison function.
    try {
        compFunc = createBinaryCompFunc(dataSet, numUnits, numSeriesIndices);
    } catch (e) {
        if (e instanceof Error) console.error("Error creating comparison function:", e.message);
        return;
    }

    // We have not completed the dataset and have no self-comparisons or comparisons
    // like "meter in length" (only length in meters), meaning we will not have
    // reflexivity or symmetry, and therefore no orthogonality. Also, since we have no reflexive
    // units, there will be no orthogonal subsets except the empty set, so no need to check
    // the degree of orthogonality.

    // Next, if we look at the dataset, we see that an average has sometimes been computed.
    // Let's check what values we get when including the period error.
    // We use Bill's values, where the average is: 2.378.
    console.log(`Bill's average in the original data: ${2.378}`);

    // Create a unit function for Bill's period.
    const uFuncBillP = createBaseUnitFunction(compFunc, period_Bill);

    let avg: CFIval = algebra.null();
    for(let i = 0 as CFUint32; i < numSeriesIndices; i++) {
        const val = uFuncBillP.get(second, i);
        // This should not happen.
        if (val === undefined) {
            console.error("Error getting value for period of Bill.");
            return;
        }
        avg = algebra.add(avg, val) as CFIval; // This will not be undefined, dirty cast.
        algebra.add(avg, val);
    }
    avg = algebra.div(avg, [5 as CFReal, 5 as CFReal]) as CFIval; // Same
    console.log(`Bill's average using a comparison function and intervals: [${avg}]`);

    // Our value is [a, b] = [2.3678,2.3878], which for the midpoint:
    // m = (b + a) /2
    // and error
    // e = (b - a) / 2
    // is [m - e, m + e]. The low point of our average is the average of the values in the table,
    // and the high point is the average + the error (0.02). This is using standard interval arithmetic.
    // We can see from the print that Bill's average is within our interval, so we are good.

    // Next, in the table it says that "Bonus Joe" has values that are clearly wrong. We have a mass,
    // length, and period for him, and we know that they are measuring a pendulum - let's check with
    // the formula.
    const lengthJoe2 = compFunc.get(length_Joe2, meter, 0)!;
    const periodJoe2 = compFunc.get(period_Joe2, second, 0)!;

    // Use a big range for free fall acceleration due to gravity.
    // https://en.wikipedia.org/wiki/Gravitational_acceleration
    const g: CFIval = [9.764 as CFReal, 9.834 as CFReal];

    // We use the simple formula for pendulums P = 2*pi*sqrt(l/g)
    // https://en.wikipedia.org/wiki/Pendulum_(mechanics)
    const quota = algebra.div(lengthJoe2, g) as CFIval; // This will not fail because of overflow etc.
    const sqrt = algebra.nthRoot(quota, 2 as CFUint32) as CFIval; // Neither will this.
    const formulaP = algebra.smulLeft(2*Math.PI as CFReal, sqrt);

    // Is Joe's period similar to the computed value?
    console.log(`Joe's period: [${periodJoe2}]`);
    console.log(`Formula period: [${formulaP}]`);

    // As we can see when printing, Bonus-Joe's pendulum - with its 7-millimeter-long arm - does not
    // produce a value that matches what we get from the simple formula.

    console.log("Everything worked as expected.");
    return;
}

pendulumDataset();